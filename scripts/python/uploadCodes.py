#!/usr/bin/env python

import json, re, argparse
from pprint import pprint
from server_messenger import ServerMessenger
import mysql.connector
import gspread # installed via pip install gspread
from oauth2client.client import SignedJwtAssertionCredentials

serverCapture = None
serverStorage = None
googleAPI = None

# Queries
query_get_coder = ("SELECT * FROM Coder "
                   "WHERE ShortName = %(name)s ; ")
query_push_code = ("INSERT IGNORE INTO Code "
                   "(Rumor, Period, Tweet, Coder, "
                   " Uncodable, Unrelated, Affirm, Deny, Neutral, "
                   " Implicit, Ambiguity, Uncertainty, Difficult, Text) "
                   "VALUES (%(Rumor)s, %(Period)s, %(Tweet)s, %(Coder)s, "
                   " %(Uncodable)s, %(Unrelated)s, %(Affirm)s, %(Deny)s, %(Neutral)s, "
                   " %(Implicit)s, %(Ambiguity)s, %(Uncertainty)s, %(Difficult)s, %(text)s); ")
query_add_tweet = ("INSERT IGNORE INTO Tweet "
                   "(ID, Text, `Distinct`, Type, Username, Timestamp, Origin) "
                   "VALUES (%(ID)s, %(Text)s, %(Distinct)s, %(Type)s, %(Username)s, %(Timestamp)s, %(Origin)s) ")

def main():
    parser = argparse.ArgumentParser(description='Parse a raw collection into the important constituents and/or calculate statistics on the collection',
                                add_help=True)
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="Increase output verbosity")
    parser.add_argument("-c", "--config", required=False, default='../../local.conf',
                        help='Name of configuration file')
    global options
    options = parser.parse_args()

    connectToServer()
    cursor = serverStorage.cursor()
    
    # Set parameters
    event_name = "Paris" # Umpqua Paris
    rumor_name = "Bot Prediction" # Crisis Actors Bot Prediction
    period_name = "Training" # Coding Training
    
    # 1 Paris Bot Prediction
    # 5 Umpqua Crisis Actors
    # 6 Paris Crisis Actors
    
    rumor_id = 1
    period_id = -1
    
    search_title = ' ' + event_name + ' ' + rumor_name + ' ' + period_name
    
    # Open spreadsheets
#    spreadsheet = googleAPI.open('Conrad Umpqua Crisis Actors Coding Sheet')
    sheets = googleAPI.openall();
    for sheet in sheets:
        title = None
        for entry in sheet._feed_entry:
            if(entry.text and search_title in entry.text):
                title = entry.text
                
        if(title):
            name = title.split(' ')[0]
            print(name)
            cursor.execute(query_get_coder, {'name': name})
            coder_id = cursor.fetchone()[0]
            
            worksheet = sheet.get_worksheet(0)
            codes = worksheet.get_all_records()
            
            for code in codes:
                code['Coder']     = coder_id
                code['Rumor']     = rumor_id
                code['Tweet']     = code['tweet_id']
                code['Period']    = period_id
                code['Uncodable'] = bool(code['Uncodable'])
                code['Unrelated'] = bool(code['Unrelated'])
                code['Affirm']    = bool(code['Affirm'])
                code['Deny']      = bool(code['Deny'])
                code['Neutral']   = bool(code['Neutral'])
                code['Implicit']  = bool(code['Implicit'])
                code['Ambiguity'] = bool(code['Ambiguity'])
                code['Uncertainty'] = bool(code['Uncertainty'])
                code['Difficult'] = bool(code['Difficult'])
                
                cursor.execute(query_push_code, code)
        serverStorage.commit()
    cursor.close()
    
    if(serverStorage is not None):
        serverStorage.close()
                        
def connectToServer():
    if(options.verbose): print("    Connecting to Captures Database")
    
    with open(options.config) as config_file:
        config = json.load(config_file)
        
        # MySQL Storage
        global serverStorage
        serverStorage = mysql.connector.connect(
            user=config["storage"]["user"],
            password=config["storage"]["password"],
            host=config["storage"]["host"],
            database=config["storage"]["database"]
        )
            
        global googleAPI
        scope = ['https://spreadsheets.google.com/feeds']
        credentials = SignedJwtAssertionCredentials(config["google_api"]['client_email'], config["google_api"]['private_key'].encode(), scope)
        googleAPI = gspread.authorize(credentials)

if __name__ == "__main__":
    main()
