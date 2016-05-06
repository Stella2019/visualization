#!/usr/bin/env python

import json, re, csv
from pprint import pprint
import mysql.connector

# Queries
#query = ("UPDATE IGNORE User "
#        "SET Bot = %(Bot)s, "
#        "    Botnet = %(Botnet)s "
#        "WHERE Event = %(Event)s "
#        "    AND Subset = %(Subset)s "
#        "    AND UserID = %(UserID)s ")
query = ("UPDATE IGNORE User "
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

def main():
    database = connectToServer()
    cursor = database.cursor()
    
#    folder = '/Users/aconradnied/Google Drive/Grad School/*Misinfo_Research_DRG/2015-2016/Bots Research/Tables/'
#    filename = 'EarlyBotnetLabels.csv'
    folder = '/Users/aconradnied/Google Drive/Grad School/MisInfo Group/Twitter Bots/'
    filename = 'bot_scores_all_crisis_actor.csv'
    counted = 0
    with open(folder + filename, 'rb') as csvfile:
        csvrows = csv.reader(csvfile, delimiter=',')
        for row in csvrows:
            data = {
                'Event': -9, # -9, 1100 || -8, 780|872 || 91, 1090
                'Subset': 1100,
                'Screenname': row[0],
                'TruthyContent': row[1],
                'TruthyTemporal': row[2],
                'TruthyNetwork': row[3],
                'TruthyFriend': row[4],
                'TruthySentiment': row[5],
                'TruthyUser': row[6],
                'TruthyScore': row[7]
#                'UserID': row[0],
#                'Bot': 1 if row[2] not in ['Probably', 'Probably not', 'No', 'Unknowable'] else 0,
#                'Botnet': row[2]
            }
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
