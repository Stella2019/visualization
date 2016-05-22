#!/usr/bin/env python

import json, re, csv
from pprint import pprint
import mysql.connector

event = -9
subset = 1100
feature = 'BotLabel' # Cluster, BotLabel, Truthy

# Queries
#query = ("INSERT INTO UserLabel "
#         "(Event, Subset, UserID, Screenname, Bot, Botnet, Sample, Cluster, Cluster2, Profile, Status) "
#        "VALUES (%(Event)s, %(Subset)s, %(UserID)s, %(Screenname)s, %(Bot)s, %(Botnet)s, %(Sample)s, %(Cluster)s, %(Cluster2)s, %(Profile)s, %(Status)s) "
#        "ON DUPLICATE KEY UPDATE Screenname=%(Screenname)s, Bot=%(Bot)s, Botnet=%(Botnet)s, Sample=%(Sample)s, Cluster=%(Cluster)s, Cluster2=%(Cluster2)s, Profile=%(Profile)s, Status=%(Status)s;")
query = ("UPDATE IGNORE UserLabel "
        "SET Screenname=%(Screenname)s, Bot=%(Bot)s, Botnet=%(Botnet)s, Sample=%(Sample)s, Cluster=%(Cluster)s, Profile=%(Profile)s, Status=%(Status)s "
        "WHERE Event = %(Event)s "
        "    AND Subset = %(Subset)s "
        "    AND UserID = %(UserID)s ;")
if(feature == 'Truthy'):
    query = ("UPDATE IGNORE UserLabel "
            "SET TruthyScore = %(TruthyScore)s, "
            "    TruthyContent = %(TruthyContent)s, "
            "    TruthyTemporal = %(TruthyTemporal)s, "
            "    TruthyNetwork = %(TruthyNetwork)s, "
            "    TruthyFriend = %(TruthyFriend)s, "
            "    TruthySentiment = %(TruthySentiment)s, "
            "    TruthyUser = %(TruthyUser)s "
            "WHERE Event = %(Event)s "
            "    AND Subset = %(Subset)s "
            "    AND Screenname = %(Screenname)s ")
elif (feature == 'Cluster'):
    query = ("UPDATE IGNORE UserLabel "
            "SET Screenname = %(Screenname)s, FollowerCluster=%(FollowerCluster)s, FollowingCluster=%(FollowingCluster)s, FollowshipCluster=%(FollowshipCluster)s, FollowerClusterRaw=%(FollowerClusterRaw)s, FollowingClusterRaw=%(FollowingClusterRaw)s, FollowshipClusterRaw=%(FollowshipClusterRaw)s "
            "WHERE Event = %(Event)s "
            "    AND Subset = %(Subset)s "
            "    AND UserID = %(UserID)s ;")

def main():
    database = connectToServer()
    cursor = database.cursor()
    
    folder = 'C:\\Users\\anied\\Google Drive\\Grad School\\MisInfo Group\\Twitter Bots\\'
    filename = 'ManualAnnotation_20160520_1516.tsv'
    if(feature == 'Truthy'):
        filename = 'bot_scores_all_crisis_actor.csv'
    elif (feature == 'Cluster'):
        filename = 'Both Crisis Actors Graph\\BothCrisisActors_Clusters.csv'
    
    counted = 0
    with open(folder + filename, 'r') as csvfile:
        delim = '\t'
        if(feature == 'Truthy' or feature == 'Cluster'):
            delim = ','
        csvrows = csv.reader(csvfile, delimiter=delim)
        for row in csvrows:


            data = {
                'Event': event,
                'Subset': subset,
            }
            if(feature == 'BotLabel'):
                botnet = row[5]
                bot = 'Bot'
                if(botnet == 'Unknowable' or len(botnet) == 0): bot = 'Unlabeled'
                if(botnet == 'No'): bot = 'Human'
                if('Probably' in botnet or 'Hybrid' == botnet): bot = 'Uncertain'
                if('TRS' in botnet): bot = 'TRS'

                data['UserID'] = row[0]
                data['Screenname'] = row[1][:25]
                data['Sample'] = row[2][:25]
                data['Cluster'] = row[3][:25]
    #           data['Cluster2'] = row[4][:25]
                data['Bot'] = bot
                data['Botnet'] = botnet[:25]
                data['Status'] = row[6][:10] or 'Active'
                data['Profile'] = row[7][:45]
            elif(feature == 'Truthy'):
                data['Screenname'] = row[0]
                data['TruthyContent'] = row[1]
                data['TruthyTemporal'] = row[2]
                data['TruthyNetwork'] = row[3]
                data['TruthyFriend'] = row[4]
                data['TruthySentiment'] = row[5]
                data['TruthyUser'] = row[6]
                data['TruthyScore'] = row[7]
            elif (feature == 'Cluster'):
                data['UserID'] = row[0]
                data['Screenname'] = row[1][:25]
                data['FollowerCluster'] = row[2]
                data['FollowingCluster'] = row[3]
                data['FollowshipCluster'] = row[4]
                data['FollowerClusterRaw'] = row[5]
                data['FollowingClusterRaw'] = row[6]
                data['FollowshipClusterRaw'] = row[7]
            
            cursor.execute(query, data)
            counted += 1
            if(counted % 1000 == 0):
                print(str(counted))
                database.commit()
    
    print(str(counted))
    database.commit()
    
    cursor.close()
    database.close()
                        
def connectToServer():
    with open('../../local.conf') as config_file:
        config = json.load(config_file)
        
        # MySQL Storage
        return mysql.connector.connect(
            user=config["storage"]["user"],
            password=config["storage"]["password"],
            host=config["storage"]["host"],
            database=config["storage"]["database"]
        )

if __name__ == "__main__":
    main()
