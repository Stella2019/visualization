import csv
import json
import time
import mysql.connector

#uname_to_follower_id = json.load(open('data/username_to_follower_id.json'))
#uname_to_friend_id = json.load(open('data/username_to_friend_id.json'))
#uname_to_udata = json.load(open('data/username_to_user_data.json'))

threshold = 0.01

# Connect to MySQL Storage
config_file = 'somelab.conf'
config = json.load(open(config_file))
storage = mysql.connector.connect(
    user=config["storage"]["user"],
    password=config["storage"]["password"],
    host=config["storage"]["host"],
    database=config["storage"]["database"]
)
cursor = storage.cursor(dictionary=True)
query = "CALL GetFollowerList_forXLM()"

users = []
for result in cursor.execute(query, multi=True):
    if result.with_rows:
        print (str(result.statement))
        users = result.fetchall()
        print(str(len(users)) + ' Users Found!')

def dbIterator(cursor, arraysize=1000):
    'An iterator that uses fetchmany to keep memory usage down'
    while True:
        results = cursor.fetchmany(arraysize)
        if not results:
            break
        for result in results:
            yield result

def intersection(l1, l2):
    return set(l1) & set(l2)

def union(l1, l2):
    return set(l1) | set(l2)

def write_edges(users, output_filename):
    writer = csv.writer(open(output_filename, 'w+'))
    users_writer = csv.writer(open('xlm_sharedaudience_users.csv', 'w+'))
    n_sharedAudience_abovethreshold = 0

    for index1 in range(len(users)):
        user1 = users[index1]
        uname = user1['Screenname']
        uid   = user1['UserID']
        followers = user1['Followers'].split(',')
        
        whoslivematter = ''
        if(user1['BLM Tweets'] > 0):
            whoslivematter += 'black'
        if(user1['ALM Tweets'] > 0):
            whoslivematter += 'all'
        if(user1['BlueLM Tweets'] > 0):
            whoslivematter += 'blue'
        
        users_writer.writerow([uid, uname, user1['BLM Tweets'], user1['ALM Tweets'], user1['BlueLM Tweets'], user1['ActualFollowers'], whoslivematter])
        
        if len(followers) > 0:
            print (output_filename + '\t' + str(index1) + '/' + str(len(users)))

            for index2 in range(index1 + 1, len(users)):
                user2 = users[index2];
                uname2 = user2['Screenname']
                uid2   = user2['UserID']
                followers2 = user2['Followers'].split(',')
                
                if len(followers2) > 0:
                    # print uname + ', ' + uname2
                    lIntersect = intersection(followers, followers2)
                    nIntersect_weighted = float(len(lIntersect)) * (float(user1['ActualFollowers']) / user1['RetrievedFollowers']) * (float(user2['ActualFollowers']) / user2['RetrievedFollowers'])
                    nUnion = max(user1['ActualFollowers'] + user2['ActualFollowers'] - nIntersect_weighted, 0)
                    
                    sharedAudience_bi = nIntersect_weighted / nUnion
#                    sharedAudience_uni = nIntersect_weighted / user1['ActualFollowers']
#                    sharedAudience_uni2 = nIntersect_weighted / user2['ActualFollowers']
#                    print([uid, uid2, len(lIntersect), nIntersect_weighted, nUnion, sharedAudience_bi])
                    if(sharedAudience_bi > threshold):
                        n_sharedAudience_abovethreshold += 1
                        writer.writerow([uid, uid2, sharedAudience_bi])
            
            print ('\t\t\t\t\t\tShared Audience with: ' + str(n_sharedAudience_abovethreshold))

#write_edges(uname_to_follower_id, 'data/weights_followers.csv', lambda x: int(uname_to_udata[x]['followers_count']))
#write_edges(uname_to_friend_id, 'data/weights_friends.csv', lambda x: int(uname_to_udata[x]['friends_count']))
#write_edges(uname_to_all_ids, 'data/weights.csv', lambda x: int(uname_to_udata[x]['followers_count']) + int(uname_to_udata[x]['friends_count']))

write_edges(users, 'xlm_sharedaudience.csv')

