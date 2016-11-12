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
follower_list_cap = 20000

# Data storage
storage = False
cursor = False
twitter_api = False
users_to_fetch = []

cancelled = False

# Load server
def main():
    connectToServer()
    checkUsersToFetch()
    iterateThroughFollowerList()
    exit()

# Every so often check MySQL for new followers to fetch
def checkUsersToFetch():
    print ('check users to fetch')
    query = "SELECT * FROM FetchingUserFollowersStatus WHERE Status='Pending' ORDER BY `Priority` DESC"
    cursor.execute(query)
    
    global users_to_fetch
    users_to_fetch = cursor.fetchall()

# If we have user follower lists to fetch, upload it!
def iterateThroughFollowerList():
    n_users = len(users_to_fetch)
    if(n_users > 0):
        for user_index in range(0, n_users):
            user = users_to_fetch[user_index]
            user_id = user['UserID']
            print('Fetching Followers ({0: 5d}/{1: 5d}): {2:.0f}'.format(user_index, n_users, user_id))
            
            # Rate Limit
            requests_needed = min(math.floor(user['Followers'] / 5000) + 1, 5)
            while(checkRateLimit() < requests_needed and not cancelled):
                print('Rate Limited, waiting\t\t\t\t\t\t')
                count_down(5)
            
            # Get & push follower list
            follower_ids = fetchUsersFollowers(user_id)
            submitFollowerListToStorage(user_id, follower_ids)
            time.sleep(1)

# Grab a user's followers
def fetchUsersFollowers(user_id):
    ids = []
    try:
        for page in tweepy.Cursor(twitter_api.followers_ids, user_id=user_id).pages():
            ids.extend(page)
            if len(ids) > follower_list_cap:
                ids.append('<Capped>')
                break
    except tweepy.RateLimitError:
        count_down(wait_time)
        return fetchUsersFollowers(user_id)
    except tweepy.error.TweepError as err:
        if('429' in str(err)): # Rate limit error
            print(err) 
            count_down(wait_time)
            return fetchUsersFollowers(user_id)
        if('401' in str(err)): # Unauthorized error
            print("Unauthorized (Error 401) - probably a protected user") # Rate limit error
            ids.append('<Protected>')
            return ids
        if('404' in str(err)): # Unauthorized error
            print("Not found (Error 404) - user has probably been deleted/removed") # Rate limit error
            ids.append('<Removed>')
            return ids
            
        print(err)
        count_down(1)
    except KeyboardInterrupt:
        cancelled = True
        exit()
    return ids

def submitFollowerListToStorage(user_id, follower_ids):
    user_status = 'Other'
    if(len(follower_ids) == 0):
        user_status = 'Other'
    elif(follower_ids[-1] == '<Capped>'):
        del follower_ids[-1]
        user_status = 'Capped'
    elif(follower_ids[-1] == '<Protected>'):
        del follower_ids[-1]
        user_status = 'Protected'
    elif(follower_ids[-1] == '<Removed>'):
        del follower_ids[-1]
        user_status = 'Removed'
    else:
        user_status = 'Retrieved'
        
    updateUserStatus(user_id, user_status, len(follower_ids))
    uploadFollowers(user_id, follower_ids)
    storage.commit()
            
def updateUserStatus(user_id, status, followers_retrieved):
    print('\t\t\t\t\t\t {2:d} {1:s}'.format(user_id, status, followers_retrieved))
    query = "UPDATE FetchingUserFollowersStatus SET `Status`=%(Status)s, `LastUpdated`=NOW(), `FollowersRetrieved`=%(FollowersRetrieved)s WHERE `UserID` = %(UserID)s"
    cursor.execute(query, {'UserID': user_id, 'Status': status, 'FollowersRetrieved': followers_retrieved});

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
        print('Cancelled')
        cancelled = True
        exit()
    
def exit():
    cursor.close()
    storage.close()

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

# Other
if __name__ == "__main__":
    main()
