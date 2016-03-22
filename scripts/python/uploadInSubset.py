#!/usr/bin/env python

import json, re, argparse
from pprint import pprint
from server_messenger import ServerMessenger
import mysql.connector
import gspread # installed via pip install gspread
from oauth2client.client import SignedJwtAssertionCredentials
import parse_raw_JSON

database = None

# Queries
query_add_tweet_to_subset = ("INSERT IGNORE INTO InSubset "
             "(Tweet_ID, Event_ID)"
             "VALUES (%(Tweet_ID)s, %(Event_ID)s)")

def main():
    connectToServer()
    cursor = serverStorage.cursor()
    
    
    
    if(serverStorage is not None):
        serverStorage.close()
                        
def connectToServer():
    with open('../../local.conf') as config_file:
        config = json.load(config_file)
        
        # MySQL Storage
        global database
        database = mysql.connector.connect(
            user=config["storage"]["user"],
            password=config["storage"]["password"],
            host=config["storage"]["host"],
            database=config["storage"]["database"]
        )

if __name__ == "__main__":
    main()
