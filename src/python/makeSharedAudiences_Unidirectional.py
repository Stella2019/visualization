import csv
import json
import time
import mysql.connector

threshold = 0.2
threshold_uni = 0.5

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
collection = 'orlandoshooting' # XLM
query = "CALL GetFollowerList_forOrlandoShooting()"
#query = "CALL GetFollowerList_forXLM()"

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

def write_edges(users):
    writer = csv.writer(open(collection + '_edgelist_sharedaudience_0p20.csv', 'w+'))
    writer_uni = csv.writer(open(collection + '_edgelist_sharedaudience_0p50_unidirectional.csv', 'w+'))
    users_writer = csv.writer(open(collection + '_nodelist.csv', 'w+'))
    n_sharedAudience_abovethreshold = 0
    n_sharedAudience_uni_abovethreshold = 0
    nUsers = len(users)
    nOrphans = 0
    nOrphans_uni = 0

    for index1 in range(nUsers):
        user1 = users[index1]
        uname = user1['Screenname']
        uid   = user1['UserID']
        followers = user1['Followers'].split(',')
        nFollowers = len(followers)
        nFollowersActual = max(user1['ActualFollowers'], nFollowers)
        nEdges = 0
        nEdges_uni = 0
        
        if(collection == 'xlm'):
            whoslivematter = ''
            if(user1['BLM Tweets'] > 0):
                whoslivematter += 'black'
            if(user1['ALM Tweets'] > 0):
                whoslivematter += 'all'
            if(user1['BlueLM Tweets'] > 0):
                whoslivematter += 'blue'
        
            users_writer.writerow([uid, uname, user1['BLM Tweets'], user1['ALM Tweets'], user1['BlueLM Tweets'], nFollowers, user1['ActualFollowers'], whoslivematter])
        else:
            users_writer.writerow([uid, uname, user1['Tweets'], user1['ActualFollowers']])
        
        if nFollowers > 0:

            for index2 in range(index1 + 1, nUsers):
                user2 = users[index2];
                uname2 = user2['Screenname']
                uid2   = user2['UserID']
                followers2 = user2['Followers'].split(',')
                nFollowers2 = len(followers2)
                nFollowersActual2 = max(user2['ActualFollowers'], nFollowers2)
                
                if nFollowers2 > 0:
                    # print uname + ', ' + uname2
                    lIntersect = intersection(followers, followers2)
                    nIntersect = len(lIntersect)
                    correctionUser1 = float(nFollowersActual) / nFollowers
                    correctionUser2 = float(nFollowersActual2) / nFollowers2
                    nIntersect_weighted = float(nIntersect) * correctionUser1 * correctionUser2
                    nIntersect_weighted = min(nIntersect_weighted, nFollowersActual, nFollowersActual2)
                    nUnion = max(nFollowersActual + nFollowersActual2 - nIntersect_weighted, 1)
                    
                    sharedAudience_bi = nIntersect_weighted / nUnion
                    sharedAudience_uni = nIntersect_weighted / nFollowersActual
                    sharedAudience_uni2 = nIntersect_weighted / nFollowersActual2
#                    print([uid, uid2, len(lIntersect), nIntersect_weighted, nUnion, sharedAudience_bi])
                    if(sharedAudience_bi > threshold):
#                        print('Connect {0: 5d} <-> {1: 5d}, SA {2:.0f} / {3:.0f} = {4:.1f}. Unweighted: {5:d}'.format(index1, index2, nIntersect_weighted, nUnion, sharedAudience_bi, nIntersect))
                        n_sharedAudience_abovethreshold += 1
                        nEdges += 1
                        writer.writerow([uid, uid2, sharedAudience_bi])
                    if(sharedAudience_uni > threshold_uni):
#                        print('Connect {0: 5d}  -> {1: 5d}, SA {2:.0f} / {3:.0f} = {4:.1f}. Unweighted: {5:d}'.format(index1, index2, nIntersect_weighted, nFollowersActual, sharedAudience_uni, nIntersect))
#                        print('User {0:d}\tFollowers: {1:d}\tFollowers Actual: {2:d}\tCorrection: {3:.2f}'.format(uid, nFollowers, nFollowersActual, correctionUser1))
#                        print('User {0:d}\tFollowers: {1:d}\tFollowers Actual: {2:d}\tCorrection: {3:.2f}'.format(uid2, nFollowers2, nFollowersActual2, correctionUser2))
                        n_sharedAudience_uni_abovethreshold += 1
                        nEdges_uni += 1
                        writer_uni.writerow([uid, uid2, sharedAudience_uni])
                    if(sharedAudience_uni2 > threshold_uni):
#                        print('Connect {0: 5d} <-  {1: 5d}, SA {2:.0f} / {3:.0f} = {4:.1f}. Unweighted: {5:d}'.format(index2, index1, nIntersect_weighted, nFollowersActual2, sharedAudience_uni2, nIntersect))
                        n_sharedAudience_uni_abovethreshold += 1
                        nEdges_uni += 1
                        writer_uni.writerow([uid2, uid, sharedAudience_uni2])
            
            if(nEdges < 1):
                nOrphans += 1
            if(nEdges_uni < 1):
                nOrphans_uni += 1
            
            print('Users: {0: 5d}/{1: 5d}\tSA-bi Edges: {2:d}\tOrphans: {3:d}\tSA-uni Edges: {4:d}\tOrphans: {5:d}'.format(index1, nUsers, n_sharedAudience_abovethreshold, nOrphans, n_sharedAudience_uni_abovethreshold, nOrphans_uni))

#write_edges(uname_to_follower_id, 'data/weights_followers.csv', lambda x: int(uname_to_udata[x]['followers_count']))
#write_edges(uname_to_friend_id, 'data/weights_friends.csv', lambda x: int(uname_to_udata[x]['friends_count']))
#write_edges(uname_to_all_ids, 'data/weights.csv', lambda x: int(uname_to_udata[x]['followers_count']) + int(uname_to_udata[x]['friends_count']))

#write_edges(users, 'orlandoshooting_edgelist_sharedaudience_0p01.csv')
write_edges(users)

