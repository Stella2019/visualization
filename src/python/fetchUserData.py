from __future__ import print_function
import datetime
import json
import sys
import math
import time
from datetime import datetime
import tweepy
import mysql.connector
from pprint import pprint
import uploadTweetsFromJSON

# Parameters
wait_time = 15
#config_file = '../../local.conf'
config_file = 'twitter_api1.conf'
follower_list_cap = 25000
followers_per_packet = 5000
MAX_TWEETS_FETCHED = 3000
TWEETS_PER_PACKET = 200
USERS_PER_ITERATION = 1
DEFAULT_ATTEMPTS = 16
WAIT_TO_RETRY = 1 # minute

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
    global cancelled
    # Set parameters
    if (len(sys.argv) > 1 and sys.argv[1] == 'friends'):
        global config_file
        config_file = 'twitter_api2.conf'
    
    connectToServer()
    print ('** Check users to fetch **')
    checkUsersToFetch()
    
    while(len(users_to_fetch) > 0  and not cancelled):
        try: # Catch all outstanding errors here
            iterateThroughUsers()
        except:
            closeConnections()
            raise
        
        # Grab another group of followers to fetch
        print ('** Fetch more users **')
        if(openConnection and not cancelled):
            checkUsersToFetch()
    
    # Wrap up
    print ('** All done! **')
    closeConnections()

# Every so often check MySQL for new followers to fetch
def checkUsersToFetch():
    # Get the next <USERS_PER_ITERATION> users
    query = "SELECT * FROM UserDataQueue WHERE `TweetsStatus`='Pending' ORDER BY `Priority` DESC LIMIT " + str(USERS_PER_ITERATION)
    cursor.execute(query)
    
    global users_to_fetch
    users_to_fetch = cursor.fetchall()
    
    # Mark them as being reserved by this python script to be fetched 
    # Note, there is a potential non-destructive race condition here
    query = "UPDATE UserDataQueue SET `Status`='Reserved' WHERE `UserID` = %(UserID)s"
    for user in users_to_fetch:
        cursor.execute(query, user)
    storage.commit()

# If we have user follower lists to fetch, upload it!
def iterateThroughUsers():
    global cancelled
    n_users = len(users_to_fetch)
    if(n_users > 0):
        for user_index in range(0, n_users):
            try:
                if(cancelled):
                    return
                user = users_to_fetch[user_index]
#                print('Fetching User Data ({0: 5d}/{1: 5d}): {2:.0f}'.format(user_index, n_users, user['UserID']))

                # Get & push follower list
                fetchUsersData(user)
                if(cancelled):
                    return
                submitDataToStorage(user)
                time.sleep(1) # Small delay to avoid overwhelming the system
            except KeyboardInterrupt:
                print('** Cancelled **\t\t\t\t\t ')
                cancelled = True
                closeConnections()
                return

# Grab a user's followers
def fetchUsersData(user):
    global cancelled
    if(cancelled):
        return
    
    # Check user profile from tweet
    checkUser(user)
    fetchFollowers(user)
    fetchFriends(user)
    fetchTweets(user)
    
    # Wrap up
    if(user['Status'] == 'Pending'):
        user['Status'] = 'Retrieved'
        
        
def checkUser(user):
    global cancelled
    attemptsLeft = DEFAULT_ATTEMPTS
    while(attemptsLeft > 0 and not cancelled):
        try:
            userFromAPI = twitter_api.get_user(user_id=user['UserID'])

            user['FollowersActual'] = userFromAPI.followers_count
            user['FriendsActual'] = userFromAPI.friends_count
            user['TweetsActual'] = userFromAPI.statuses_count

            if(userFromAPI.protected):
                user['Status'] = 'Protected'
            attemptsLeft = 0
        except tweepy.error.TweepError as err:
            err = str(err)
            if('429' in err or 'Rate limit' in err): # Rate limit error
                print('429: Rated Limited - wait and try again') 
                count_down(WAIT_TO_RETRY)
                keepOnTrying = True
                attemptsLeft -= 1
            else:
                if('401' in err or 'Not authorized' in err):
                    user['Status'] = 'Protected'
                elif('403' in err or 'suspended' in err):
                    user['Status'] = 'Suspended'
                elif('404' in err or 'does not exist' in err or 'not found' in err):
                    user['Status'] = 'Removed'
                elif('104' in err or 'Connection reset' in err):
                    print('104: Connection reset - wait and try again') 
                    attemptsLeft -= 1
                else:
                    print("!!! Unhandled Tweepy error: " + err)
                    user['Status'] = 'Other'
                    aborted = True
                attemptsLeft = 0
        except KeyboardInterrupt:
            print('** Cancelled **\t\t\t\t\t ')
            cancelled = True
            closeConnections()
            return
    print('User ' + str(user['UserID']) + ' ' + user['Status'])
        
def fetchFollowers(user):
    global cancelled
    if(not cancelled and user['FollowersStatus'] == 'Pending' or user['FollowersStatus'] == 'Capped'):
        print('\tFetch Followers (' + str(user['FollowersActual']) + ')', end='')
        attemptsLeft = DEFAULT_ATTEMPTS
        if(user['Status'] in ['Protected', 'Suspended', 'Removed', 'Other']):
            user['FollowersStatus'] = 'Protected'
        else:
            while(attemptsLeft > 0 and not cancelled):
                try:
                    user['FollowerList'] = []
                    for page in tweepy.Cursor(twitter_api.followers_ids, user_id=user['UserID']).pages():
                        user['FollowerList'].extend(page)
                        if len(user['FollowerList']) >= follower_list_cap:
                            break

                    if(len(user['FollowerList']) < user['FollowersActual'] and len(user['FollowerList']) >= follower_list_cap):
                        user['FollowersStatus'] = 'Capped'
                    else:
                        user['FollowersStatus'] = 'Retrieved'
                    user['FollowersRetrieved'] = len(user['FollowerList'])
                    print(' got ' + str(user['FollowersRetrieved']), end='')
                    attemptsLeft = 0
                except tweepy.error.TweepError as err:
                    err = str(err)
                    if('429' in err or 'Rate limit' in err): # Rate limit error
                        print('429: Rated Limited - wait and try again') 
                        attemptsLeft -= 1
                    elif('104' in err or 'Connection reset' in err):
                        print('104: Connection reset - wait and try again') 
                        attemptsLeft -= 1
                    elif('401' in err or 'Not authorized' in err):
                        user['FollowerStatus'] = 'Protected'
                        user['FollowersRetrieved'] = len(user['FollowerList'])
                        attemptsLeft = 0
                    else:
                        print("!!! Unhandled Tweepy error: " + err)
                        attemptsLeft = 0
                    count_down(WAIT_TO_RETRY)
                except KeyboardInterrupt:
                    print('** Cancelled **\t\t\t\t\t ')
                    cancelled = True
                    closeConnections()
                    return
        print('')
                
def fetchFriends(user):
    global cancelled
    if(not cancelled and user['FriendsStatus'] == 'Pending' or user['FriendsStatus'] == 'Capped'):
        print('\tFetch Friends (' + str(user['FriendsActual']) + ')', end='')
        attemptsLeft = DEFAULT_ATTEMPTS
        if(user['Status'] in ['Protected', 'Suspended', 'Removed', 'Other']):
            user['FriendsStatus'] = 'Protected'
        else:
            while(attemptsLeft > 0 and not cancelled):
                try:
                    user['FriendList'] = []
                    for page in tweepy.Cursor(twitter_api.friends_ids, user_id=user['UserID']).pages():
                        user['FriendList'].extend(page)
                        if len(user['FriendList']) >= follower_list_cap:
                            break

                    if(len(user['FriendList']) < user['FriendsActual'] and len(user['FriendList']) >= follower_list_cap):
                        user['FriendsStatus'] = 'Capped'
                    else:
                        user['FriendsStatus'] = 'Retrieved'
                    user['FriendsRetrieved'] = len(user['FriendList'])
                    print(' got ' + str(user['FriendsRetrieved']), end='')
                    attemptsLeft = 0
                except tweepy.error.TweepError as err:
                    err = str(err)
                    if('429' in err or 'Rate limit' in err): # Rate limit error
                        print('429: Rated Limited - wait and try again') 
                        attemptsLeft -= 1
                    elif('104' in err or 'Connection reset' in err):
                        print('104: Connection reset - wait and try again') 
                        attemptsLeft -= 1
                    elif('401' in err or 'Not authorized' in err):
                        user['FriendStatus'] = 'Protected'
                        user['FriendsRetrieved'] = len(user['FriendList'])
                        attemptsLeft = 0
                    else:
                        print("!!! Unhandled Tweepy error: " + err)
                        attemptsLeft = 0
                    count_down(WAIT_TO_RETRY)
                except KeyboardInterrupt:
                    print('** Cancelled **\t\t\t\t\t ')
                    cancelled = True
                    closeConnections()
                    return
        print('')

def fetchTweets(user):
    global cancelled
    if(not cancelled and user['TweetsStatus'] == 'Pending'):
        print('\tFetch Tweets (' + str(user['TweetsActual']) + ')', end='')
        attemptsLeft = DEFAULT_ATTEMPTS
        if(user['Status'] in ['Protected', 'Suspended', 'Removed', 'Other']):
            user['TweetsStatus'] = 'Protected'
        else:
            while(attemptsLeft > 0 and not cancelled):
                try:
                    user['TweetList'] = []
                    for page in tweepy.Cursor(twitter_api.user_timeline, user_id=user['UserID'], count=TWEETS_PER_PACKET, exclude_replies=False, include_rts=True).pages():
                        user['TweetList'].extend(page)
                        if len(user['TweetList']) >= MAX_TWEETS_FETCHED:
                            break

                    if(len(user['TweetList']) < user['TweetsActual'] and len(user['TweetList']) >= MAX_TWEETS_FETCHED):
                        user['TweetsStatus'] = 'Capped'
                    else:
                        user['TweetsStatus'] = 'Retrieved'
                    user['TweetsRetrieved'] = len(user['TweetList'])
                    print(' got ' + str(user['TweetsRetrieved']), end='')
                    attemptsLeft = 0
                except tweepy.error.TweepError as err:
                    err = str(err)
                    if('429' in err or 'Rate limit' in err): # Rate limit error
                        print('429: Rated Limited - wait and try again') 
                        attemptsLeft -= 1
                    elif('104' in err or 'Connection reset' in err):
                        print('104: Connection reset - wait and try again') 
                        attemptsLeft -= 1
                    elif('401' in err or 'Not authorized' in err):
                        user['TweetsStatus'] = 'Protected'
                        user['TweetsRetrieved'] = len(user['TweetList'])
                        attemptsLeft = 0
                    else:
                        print("!!! Unhandled Tweepy error: " + err)
                        attemptsLeft = 0
                    count_down(WAIT_TO_RETRY)
                except KeyboardInterrupt:
                    print('** Cancelled **\t\t\t\t\t ')
                    cancelled = True
                    closeConnections()
                    return
        print('')
        
def submitDataToStorage(user):
    # Get the status of the retrieval & update accordingly
    if('FollowerList' in user):
        user['FollowersRetrievalDate'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        if(len(user['FollowerList']) > 0):
            uploadFollowers(user['UserID'], user['FollowerList'])
        else:
            user['FollowersStatus'] = 'Protected'
    
    if('FriendList' in user):
        user['FriendsRetrievalDate'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        if(len(user['FriendList']) > 0):
            uploadFriends(user['UserID'], user['FriendList'])
        else:
            user['FriendsStatus'] = 'Protected'
            
    if('TweetList' in user):
        user['TweetsRetrievalDate'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        if(len(user['TweetList']) > 0):
            uploadTweets(user['UserID'], user['TweetList'])
        else:
            user['TweetsStatus'] = 'Protected'
    
    updateUserStatus(user)
    storage.commit()
            
def updateUserStatus(user):
#    print('\t\t\t\t\t\t {0:s}: {1:s} of {2:s} Followers, {3:s} of {4:s} Friends'.format(user['Status'], str(user['FollowersRetrieved']), str(user['FollowersActual']), str(user['FriendsRetrieved']), str(user['FriendsActual'])))
    query = "UPDATE UserDataQueue SET `Status`=%(Status)s "
    
    query += ", `FollowersStatus`=%(FollowersStatus)s, `FollowersActual`=%(FollowersActual)s "
    if('FollowerList' in user):
        if(len(user['FollowerList']) > 0):
            query += ", `FollowersRetrieved`=%(FollowersRetrieved)s, `FollowersRetrievalDate`=%(FollowersRetrievalDate)s "
        del user['FollowerList']
        
    query += ", `FriendsStatus`=%(FriendsStatus)s, `FriendsActual`=%(FriendsActual)s "
    if('FriendList' in user):
        if(len(user['FriendList']) > 0):
            query += ", `FriendsRetrieved`=%(FriendsRetrieved)s, `FriendsRetrievalDate`=%(FriendsRetrievalDate)s "
        del user['FriendList']
        
    query += ", `TweetsStatus`=%(TweetsStatus)s, `TweetsActual`=%(TweetsActual)s "
    if('TweetList' in user):
        if(len(user['TweetList']) > 0):
            query += ", `TweetsRetrieved`=%(TweetsRetrieved)s, `TweetsRetrievalDate`=%(TweetsRetrievalDate)s "
        del user['TweetList']
    
    query += "WHERE `UserID` = %(UserID)s"
    cursor.execute(query, user)

def uploadFollowers(user_id, follower_ids):
    if(len(follower_ids) == 0):
        return
    combined_ids = ",".join("(" + str(user_id) + ", " + str(follower_id) + ")" for follower_id in follower_ids)
    query = "INSERT IGNORE INTO Follow (UserID, Follower) VALUES " + combined_ids
    
    attemptsLeft = DEFAULT_ATTEMPTS
    while(attemptsLeft > 0):
        try:
            cursor.execute(query)
            return
        except mysql.connector.errors.InternalError as err:
            err = str(err)
            if('1213' in err or 'Deadlock' in err):
                # Deadlock while inserting into table, try again a second time
                count_down(0.16) # 10 seconds
                attemptsLeft -= 1
            else:
                print('MySQL error: ' + err)
                return
    
def uploadFriends(user_id, friend_ids):
    if(len(friend_ids) == 0):
        return
    combined_ids = ",".join("(" + str(friend_id) + ", " + str(user_id) + ")" for friend_id in friend_ids)
    query = "INSERT IGNORE INTO Follow (UserID, Follower) VALUES " + combined_ids
    
    attemptsLeft = DEFAULT_ATTEMPTS
    while(attemptsLeft > 0):
        try:
            cursor.execute(query)
            return
        except mysql.connector.errors.InternalError as err:
            err = str(err)
            if('1213' in err or 'Deadlock' in err):
                # Deadlock while inserting into table, try again a second time
                count_down(0.16) # 10 seconds
                attemptsLeft -= 1
            else:
                print('MySQL error: ' + err)
                return
            
def uploadTweets(user_id, tweets):
    query_addtweet = ("INSERT IGNORE INTO Tweet "
                      "(ID, Timestamp, Lang, Text, TextStripped, `Distinct`, "
                      "    Type, Source, ParentID, ExpandedURL, MediaURL) "
                      "VALUES (%(ID)s, %(Timestamp)s, %(Lang)s, %(Text)s, %(TextStripped)s, %(Distinct)s, "
                      "    %(Type)s, %(Source)s, %(ParentID)s, %(ExpandedURL)s, %(MediaURL)s) ")
    query_addtweetuser = ("INSERT IGNORE INTO TweetUser "
                          "(Tweet, UserID, Username, Screenname, CreatedAt, "
                          "    Description, Location, UTCOffset, Timezone, Lang, "
                          "    StatusesCount, FollowersCount, FriendsCount, "
                          "    ListedCount, FavouritesCount, Verified) "
                          "VALUES (%(ID)s, %(UserID)s, %(Username)s, %(Screenname)s, %(UserCreatedAt)s, "
                          "    %(UserDescription)s, %(UserLocation)s, %(UserUTCOffset)s, %(UserTimezone)s, %(UserLang)s, "
                          "    %(UserStatusesCount)s, %(UserFollowersCount)s, %(UserFriendsCount)s, "
                          "    %(UserListedCount)s, %(UserFavouritesCount)s, %(UserVerified)s) "
                          "ON DUPLICATE KEY UPDATE "
                          "    FavouritesCount = %(UserFavouritesCount)s, "
                          "    UserID = %(UserID)s ")
    query_addtousertimeline = ("INSERT IGNORE INTO TweetInUserTimeline "
                               "(TweetID, UserID) "
                               "VALUES (%(ID)s, %(UserID)s)")
    
    sys.stdout.flush()
    sys.stdout.write('\tUploaded {0: 5d}/{1: 5d} Tweets \r'.format(0, len(tweets)))
    for i_tweet in range(len(tweets)):
        
        raw_tweet = tweets[i_tweet]
        # Get extra tweet fields
        tweet = uploadTweetsFromJSON.parseTweetJSON(raw_tweet._json)
        
        # Clear inner dictionaries used by other programs, we aren't using them
        if 'Parent' in tweet: del tweet['Parent']
        if 'Subsets' in tweet: del tweet['Subsets']
        
        # Send query to database
        attemptsLeft = DEFAULT_ATTEMPTS
        while(attemptsLeft > 0):
            try:
                cursor.execute(query_addtweet, tweet)
                cursor.execute(query_addtweetuser, tweet)
                cursor.execute(query_addtousertimeline, tweet)
                storage.commit()
                attemptsLeft = 0
            except mysql.connector.errors.InternalError as err:
                err = str(err)
                if('1213' in err or 'Deadlock' in err):
                    # Deadlock while inserting into table, try again a second time
                    count_down(0.16) # 10 seconds
                    attemptsLeft -= 1
                else:
                    print('MySQL error: ' + err)
                    return
        
        sys.stdout.write('\tUploaded {0: 5d}/{1: 5d} Tweets \r'.format(i_tweet + 1, len(tweets)))
        sys.stdout.flush()
    print('')
    
def checkRateLimit():
    try:
        api_status = twitter_api.rate_limit_status()
        return api_status['resources']['followers']['/followers/ids']['remaining']
    except tweepy.error.TweetError as err:
        err = str(err)
        if('Errno 104' in err):
            print('104: Connection Reset by Peer - it\'s probably gone on for too long, restart connection')
            closeConnections()
            count_down(2)
            main()

def count_down(minutes):
    sys.stdout.flush()
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
    query = "UPDATE UserDataQueue SET `Status`='Pending' WHERE `UserID` = %(UserID)s AND `Status`='Reserved'"
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
