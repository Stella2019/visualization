#!/usr/bin/env python

import json, re, argparse
from pprint import pprint
import mysql.connector
import gspread # installed via pip install gspread
from oauth2client.service_account import ServiceAccountCredentials
import uploadTweetsFromJSON

serverCapture = None
serverStorage = None
googleAPI = None

# Queries
queries = {
    'get_coder': ("SELECT * FROM Coder "
                   "WHERE ShortName = %(name)s ; "),
    'push_code': ("REPLACE INTO TweetCode "
                   "(Rumor, Period, Tweet, Coder, `Primary`, "
                   " Uncodable, Unrelated, Affirm, Deny, Neutral, "
                   " Implicit, Ambiguity, Uncertainty, Difficult) "
                   "VALUES (%(Rumor)s, %(Period)s, %(Tweet)s, %(Coder)s, %(Primary)s, "
                   " %(Uncodable)s, %(Unrelated)s, %(Affirm)s, %(Deny)s, %(Neutral)s, "
                   " %(Implicit)s, %(Ambiguity)s, %(Uncertainty)s, %(Difficult)s); "),
    'push_mongotweet': ("INSERT INTO TweetInMongo "
                     "(Rumor, Tweet, Text, MongoID, Backfill) "
                     "VALUES (%(Rumor)s, %(Tweet)s, %(Text)s, %(MongoID)s, %(Backfill)s) "
                     "ON DUPLICATE KEY UPDATE MongoID=GREATEST(%(MongoID)s, MongoID)"),
    'tweet_exists': "SELECT * FROM Tweet WHERE ID=%(ID)s"
    }

def main():
    parser = argparse.ArgumentParser(description='Parse a raw collection into the important constituents and/or calculate statistics on the collection',
                                add_help=True)
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="Increase output verbosity")
    parser.add_argument("-c", "--config", required=False, default='../../local.conf',
                        help='Name of configuration file')
    parser.add_argument("-e", "--event_name", required=False, default='Event',
                        help='Name of the Event')
    parser.add_argument("-q", "--rumor_name", required=False, default='Rumor',
                        help='Name of the Rumor')
    parser.add_argument("-r", "--rumor_id", required=False, default='0',
                        help='Which rumor to choose')
    parser.add_argument("-p", "--period", required=False, type=int, default=0,
                        help='Number for the period')
    parser.add_argument("-n", "--period_name", required=False, default=0,
                        help='Name for the period')
    
    global options
    options = parser.parse_args()
    
    # Fill parameters that may not have been filled in the command line
    if(not options.event_name):
        options.event_name = input('What is the Name of the Event? ')
    if(not options.rumor_name):
        options.rumor_name = input('What is the Name of the Rumor? ')
    if(not options.rumor_id):
        options.rumor_id   = input('What is the ID   of the Rumor? ')
    if(not options.period):
        options.period = int(input('What is the #   of the Period? '))
    

    connectToServer()
    cursor = serverStorage.cursor(dictionary=True)
    
    # Set parameters
#    event_name = "Sydney Siege" # Umpqua Paris
#    rumor_name = "Hadley" # Crisis Actors Bot Prediction
    periods = ['Training 4', 'Training 3', 'Training 2', 'Training', 'Coding', 'Adjudication', 'AuxAdjud'];
    period_name = periods[options.period + 4];
    if('period_name' in options):
        period_name = options.period_name
    
#    rumor_id = 10
#    period_id = -1
    
    search_title = ' ' + options.event_name + ' ' + options.rumor_name + ' ' + period_name
    
    # Open spreadsheets
#    spreadsheet = googleAPI.open('Conrad Umpqua Crisis Actors Coding Sheet')
    sheets = googleAPI.openall();
    for sheet in sheets:
        title = None
        for entry in sheet._feed_entry:
            if(entry.text and 
               search_title in entry.text and 
               (options.period is not -1 or not any(num in entry.text for num in ['2', '3', '4', '5']))):
                title = entry.text
                
        if(title):
            name = title.split(' ')[0]
            print(name)
            cursor.execute(queries['get_coder'], {'name': name})
            coder_id = cursor.fetchone()['ID']
            
            worksheet = sheet.get_worksheet(0)
            codes = worksheet.get_all_records()
            
            for code in codes:
                # Get general information
                code['Coder']     = coder_id
                code['Rumor']     = options.rumor_id
                code['Period']    = options.period
                
                # Get codes form spreadsheet
                code['Primary'] = 'No Code'
                codes = ['Uncodable', 'Unrelated', 'Affirm', 'Deny', 'Neutral', 'Implicit', 'Ambiguity', 'Uncertainty', 'Difficult']
                for item in codes:
                    if(item in code):
                        code[item] = bool(code[item])
                    elif(item.lower() in code):
                        code[item] = bool(code[item.lower()])
                    else:
                        code[item] = 0
                    
                    if(item in ['Uncodable', 'Unrelated', 'Affirm', 'Deny', 'Neutral'] and code[item]):
                        if(code['Primary'] == 'No Code'):
                            code['Primary'] = item
                        else:
                            code['Primary'] = 'Too many codes'
                
                # Get Text
                if('text' in code):
                    code['Text'] = code['text']
                    
                # Get Mongo ID // TODO if mongoid is labeled as 'id'
                code['MongoID'] = 0
                if('db_id' in code and code['db_id']):
                    code['MongoID'] = code['db_id']
                    
                # Get Tweet ID
                if('tweet_id' in code):
                    code['Tweet'] = code['tweet_id']
                if('Tweet_ID' in code):
                    code['Tweet'] = code['Tweet_ID']
                if('id' in code):
                    code['Tweet'] = code['id']
                # note: all integers are long in python3
                if(isinstance(code['Tweet'], str)):
                    code['Tweet'] = int(float(code['Tweet'].replace(',','')))
                if(isinstance(code['Tweet'], float)):
                    code['Tweet'] = int(float(code['Tweet']))
                
                # Determine if it is backfill
                code['Backfill'] = 0
                cursor.execute(queries['tweet_exists'], {'ID': code['Tweet']})
                tweet_exists = cursor.fetchone()
                if(not tweet_exists or not tweet_exists['ID']):
                    code['Backfill'] = 1
                
                cursor.execute(queries['push_code'], code)
                cursor.execute(queries['push_mongotweet'], code)
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
        
        # Enforce UTF-8 for the connection.
        cursor = serverStorage.cursor(dictionary=True)
        cursor.execute('SET NAMES utf8mb4')
        cursor.execute("SET CHARACTER SET utf8mb4")
        cursor.execute("SET character_set_connection=utf8mb4")
        cursor.close()
        
        # Connect to Google Drive API
        global googleAPI
        scope = ['https://spreadsheets.google.com/feeds']
        credentials = ServiceAccountCredentials.from_json_keyfile_name('../../google.conf', scope)
        googleAPI = gspread.authorize(credentials)

if __name__ == "__main__":
    main()
