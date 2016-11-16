import datetime
import json
import sys
import math
import time
from time import strftime
import tweepy
import mysql.connector
from pprint import pprint

# Parameters
wait_time = 15
config_file = '../../local.conf'
follower_list_cap = 25000
followers_per_packet = 5000
users_reserved = 10

# Data storage
storage = False
cursor = False
twitter_api = False
users_to_fetch = []
#n_users_to_fetch = 0

cancelled = False
openConnection = False

# Load server
def main():
    connectToServer()
    print ('** Check users to fetch **')
    checkUsersToFetch()
    
    while(len(users_to_fetch) > 0  and not cancelled):
        iterateThroughFollowerList()
        
        # Grab another group of followers to fetch
        print ('** Fetch more users **')
        if(openConnection and not cancelled):
            checkUsersToFetch()
    
    # Wrap up
    print ('** All done! **')
    closeConnections()

# Every so often check MySQL for new followers to fetch
def checkUsersToFetch():
    # Check to see how many are pending
    #    query = "SELECT COUNT(*) AS 'Count' FROM FetchingUserFollowersQueue WHERE Status='Pending'"
    #    cursor.execute(query)
    #    
    #    global n_users_to_fetch
    #    n_users_to_fetch = cursor.fetchone()['Count']
    
    
    # Get the next 100 users
    query = "SELECT * FROM FetchingUserFollowersQueue WHERE Status='Pending' ORDER BY `Priority` DESC LIMIT " + str(users_reserved)
    cursor.execute(query)
    
    global users_to_fetch
    users_to_fetch = cursor.fetchall()
    
    
    # Mark them as being reserved by this python script to be fetched 
    # Note, there is a potential non-destructive race condition here
    query = "UPDATE FetchingUserFollowersQueue SET `Status`='Reserved' WHERE `UserID` = %(UserID)s"
    for user in users_to_fetch:
        cursor.execute(query, {'UserID': user['UserID']})
    storage.commit()

# If we have user follower lists to fetch, upload it!
def iterateThroughFollowerList():
    global cancelled
    n_users = len(users_to_fetch)
    if(n_users > 0):
        for user_index in range(0, n_users):
            try:
                if(cancelled):
                    return
                user = users_to_fetch[user_index]
                user_id = user['UserID']
                print('Fetching Followers ({0: 5d}/{1: 5d}): {2:.0f}'.format(user_index, n_users, user_id))

                # Rate Limit
                requests_needed = min(math.floor(user['Followers'] / followers_per_packet), follower_list_cap / followers_per_packet) + 1
                if(checkRateLimit() < requests_needed and not cancelled):
                    print('Rate Limited, Waiting\t\t\t\t\t\t\t\t ')
                    count_down(1)
                    while(checkRateLimit() < requests_needed and not cancelled):
                        count_down(1)

                # Get & push follower list
                follower_ids = fetchUsersFollowers(user_id)
                if(cancelled):
                    return
                submitFollowerListToStorage(user_id, follower_ids)
                time.sleep(1) # Small delay to avoid overwhelming the system
            except KeyboardInterrupt:
                print('** Cancelled **\t\t\t\t\t ')
                cancelled = True
                closeConnections()
                return

# Grab a user's followers
def fetchUsersFollowers(user_id):
    global cancelled
    if(cancelled):
        return []
    
    ids = []
    
    # Check to see if the user is protected, suspended, or deleted
    try:
        user = twitter_api.get_user(user_id=user_id)
        
        if(user.protected):
            return ['Followers: ' + str(user.followers_count), 'Protected']
        else: 
            ids.append('Followers: ' + str(user.followers_count))
    except tweepy.error.TweepError as err:
        err = str(err)
        if('429' in err or 'Rate limit' in err): # Rate limit error
            print('429: Rated Limited - wait and try again') 
            count_down(wait_time)
            return fetchUsersFollowers(user_id)
        elif('401' in err or 'Not authorized' in err):
#            print("401: Unauthorized - probably a protected user")
            return ['Protected']
        elif('403' in err or 'suspended' in err):
#            print("403: Forbidden - user has been suspended")
            return ['Suspended']
        elif('404' in err or 'does not exist' in err):
#            print("404: Not found - user has been deleted/removed")
            return ['Removed']
        else:
            print("!!! Unhandled Tweepy error: " + err)
            return ['Other']
    
    # Get follower IDs
    try:
        for page in tweepy.Cursor(twitter_api.followers_ids, user_id=user_id).pages():
            ids.extend(page)
            if len(ids) >= follower_list_cap + 1:
                break
                
        if(len(ids) < user.followers_count):
            ids.append('Capped')
        else:
            ids.append('Retrieved')
    except tweepy.error.TweepError as err:
        err = str(err)
        if('429' in err or 'Rate limit' in err): # Rate limit error
            print('429: Rated Limited - wait and try again') 
            count_down(wait_time)
            return fetchUsersFollowers(user_id)
        else:
            print("!!! Unhandled Tweepy error: " + err)
            count_down(1)
    except KeyboardInterrupt:
        print('** Cancelled **\t\t\t\t\t ')
        cancelled = True
        closeConnections()
        return []
    return ids

def submitFollowerListToStorage(user_id, follower_ids):
    # Get the status of the retrieval & update accordingly
    user_status = follower_ids[-1]
    del follower_ids[-1]
    
    actual_followers = 0
    if user_status in ['Retrieved', 'Capped', 'Protected']:
        actual_followers = int(follower_ids[0].split(' ')[1])
        del follower_ids[0]
    # Otherwise should be in ['Suspended', 'Removed', 'Other']
        
    updateUserStatus(user_id, user_status, len(follower_ids), actual_followers)
    uploadFollowers(user_id, follower_ids)
    storage.commit()
            
def updateUserStatus(user_id, status, followers_retrieved, followers_actual):
    print('\t\t\t\t\t\t {2:d} of {3:d}, {1:s}'.format(user_id, status, followers_retrieved, followers_actual))
    query = "UPDATE FetchingUserFollowersQueue SET `Status`=%(Status)s, `RetrievalDate`=NOW(), `RetrievedFollowers`=%(RetrievedFollowers)s, `ActualFollowers`=%(ActualFollowers)s WHERE `UserID` = %(UserID)s"
    cursor.execute(query, {'UserID': user_id, 'Status': status, 'RetrievedFollowers': followers_retrieved, 'ActualFollowers': followers_actual})

def uploadFollowers(user_id, follower_ids):
    if(len(follower_ids) == 0):
        return
    combined_ids = [(user_id, follower_id) for follower_id in follower_ids]
    combined_ids = ",".join("(" + str(user_id) + ", " + str(follower_id) + ")" for follower_id in follower_ids)
    query = "INSERT IGNORE INTO Follow (UserID, Follower) VALUES " + combined_ids
    cursor.execute(query)
    
def checkRateLimit():
    api_status = twitter_api.rate_limit_status()
    return api_status['resources']['followers']['/followers/ids']['remaining']

def count_down(minutes):
    try:
        for i in range(minutes * 60,0,-1):
            time.sleep(1)
            time_str = '\tTime until next request: {0:02.0f}:{1:02.0f}               \r'.format(math.floor(i/60), i%60)
            sys.stdout.write(time_str + ' ')
            sys.stdout.flush()
    except KeyboardInterrupt:
        print('** Cancelled **\t\t\t\t\t ')
        global cancelled
        cancelled = True
        closeConnections()
    
def closeConnections():
    global openConnection
    if(not openConnection): # Not necessary if we have already cleaned up
        return
    
    # Free any unfinished users
    query = "UPDATE FetchingUserFollowersQueue SET `Status`='Pending' WHERE `UserID` = %(UserID)s AND `Status`='Reserved'"
    for user in users_to_fetch:
        cursor.execute(query, {'UserID': user['UserID']})
    storage.commit()
    
    cursor.close()
    storage.close()
    
    openConnection = False

def connectToServer():
    config = json.load(open(config_file))
    
    # MySQL Storage
    global storage
    storage = mysql.connector.connect(
        user=config["storage"]["user"],
        password=config["storage"]["password"],
        host=config["storage"]["host"],
        database=config["storage"]["database"]
    )
    global cursor
    cursor = storage.cursor(dictionary=True)
    
    # Tweepy
    global twitter_api
    auth = tweepy.OAuthHandler(config['twitter_api']['consumer_key'], config['twitter_api']['consumer_secret'])
    auth.set_access_token(config['twitter_api']['access_token'], config['twitter_api']['access_token_secret'])
    
    twitter_api = tweepy.API(auth)
    
    global openConnection
    openConnection = True

# Other
if __name__ == "__main__":
    main()
