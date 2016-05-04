#!/usr/bin/env python

import json, re, csv
from pprint import pprint
import mysql.connector

# Queries
query = ("UPDATE User "
        "SET Bot = %(Bot)s, "
        "    Botnet = %(Botnet)s "
        "WHERE Event = %(Event)s "
        "    AND Subset = %(Subset)s "
        "    AND UserID = %(UserID)s ")

def main():
    database = connectToServer()
    cursor = database.cursor()
    
    folder = '/Users/aconradnied/Google Drive/Grad School/*Misinfo_Research_DRG/2015-2016/Bots Research/Tables/'
    with open(folder + '/EarlyBotnetLabels.csv', 'rb') as csvfile:
        csvrows = csv.reader(csvfile, delimiter=',')
        for row in csvrows:
            data = {
                'Event': -9,
                'Subset': 1100,
                'UserID': row[0],
                'Bot': 1 if row[2] not in ['Probably', 'Probably not', 'No', 'Unknowable'] else 0,
                'Botnet': row[2]
            }
            cursor.execute(query, data)
    
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
