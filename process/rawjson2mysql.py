#!/usr/bin/env python

import json, os, csv, sys
import argparse, unicodedata
from pprint import pprint
from datetime import datetime
from server_messenger import ServerMessenger
import mysql.connector

serverCapture = None
serverStorage = None
options = {}
collection = {'name': None}
unique_mask = 1e6
add_tweet = ("INSERT IGNORE INTO Tweet "
             "(ID, Text, Redundant, Type, Username, Timestamp, Origin)"
             "VALUES (%(ID)s, %(Text)s, %(Redundant)s, %(Type)s, %(Username)s, %(Timestamp)s, %(Origin)s)")
add_tweet_to_event = ("INSERT INTO TweetInEvent "
             "(Tweet_ID, Event_ID)"
             "VALUES (%(Tweet_ID)s, %(Event_ID)s)")

def main():
    parser = argparse.ArgumentParser(description='Parse a raw collection into the important constituents and/or calculate statistics on the collection',
                                add_help=True)
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="Increase output verbosity")
    parser.add_argument("--printtweets", action="store_true", default=False,
                        help="Print the text of all tweets, warning: can dramatically increase runtime")
    parser.add_argument("-d", "--directory", action="store_true",
                        help="Indicates that the path is pointing to a folder, should handle read all json files within")
    parser.add_argument("-s", "--statistics", action="store_true",
                        help="Instead of parsing a raw collection, instead just calculate statistics based on a the file(s)")
    parser.add_argument("-w", "--words", nargs="+", required=False,
                        help='To filter the tweets that are accepted, a word or list of words in which one of them must be present in the tweet')
    parser.add_argument("-b", "--database", action="store",
                        help="Name of database to use if not one in .conf file")
    parser.add_argument("-t", "--test", action="store_true", default=False,
                        help="Just testing the program, don't commit tweets")
    parser.add_argument("path", action="store",
                        help="Path to file/folder where the collections are to be processed.")
    global options
    options = parser.parse_args()
    
    if(options.statistics):
        pass
    else:
        if(options.directory):
            parseDir(options.path)
        else:
            parseFile(options.path)
        saveCollection()
        
        if(serverStorage is not None):
            serverStorage.close()
    
        
def parseFile(filename):
    if(options.verbose): print ("Parsing File: " + filename)

    collection_name = filename[0:-18].rsplit('/',1)[-1]
    timestamp = filename[-18:-5]
    
    # Load intermediate collection
    verifyCollection(collection_name)
    
    # Load unique minhash table and set
    unique_set = set()
    cursor = serverStorage.cursor()

    # Load this time period's JSON file
    with open(filename) as data_file: 
        for line in data_file:
            if len(line) > 5:
                
                data = json.loads(line)
                text = unicodedata.normalize('NFKD', data['text']).encode('ascii', 'replace');
#                text.replace('\n', '<br />')

                save_tweet = True
                if(options.words):
                    save_tweet = False
                    for word in options.words:
                        save_tweet |= word.lower() in text.lower().decode()
                if(not save_tweet):
                    continue
                
                # Figure out if it is unique
                hash_value = hash(text) % unique_mask
                unique = False
                if(hash_value not in unique_set):
                    unique_set.add(hash_value)
                    unique = True
             
#                if(options.verbose): 
#                    for key in data:
#                        print ("key: %s , value: %s(%s)" % (key, type(data[key]), str(data[key]).encode('utf-8')))
                
                # Assemble other attributes
                created_at = datetime.strptime(data['created_at'], '%a %b %d %X %z %Y')
                
                tweet = {
                    'ID': data['id'],
                    'Text': text,
                    'Redundant': not unique,
                    'Type': 'original',
                    'Username': None,
                    'Timestamp': datetime.strftime(created_at, '%Y-%m-%d %H:%M:%S'),
                    'Origin': None
                }
                
                if("in_reply_to_status_id_str" in data and data['in_reply_to_status_id_str'] is not None): 
                    tweet['Origin'] = data['in_reply_to_status_id_str']
                    tweet['Type'] = 'reply'
                elif("quote_status_id_str" in data and data['quote_status_id_str'] is not None): 
                    tweet['Origin'] = data['quote_status_id_str']
                    tweet['Type'] = 'quote'
                elif("retweeted_status" in data and (data['retweeted_status']) is not None):
                    if('id' in data['retweeted_status']):
                        tweet['Origin'] = data['retweeted_status']['id']
                    tweet['Type'] = 'retweet'
                if("user" in data and "screen_name" in data["user"]):
                    tweet['Username'] = data['user']['screen_name']
                
                if(options.printtweets): pprint(tweet)
                
                cursor.execute(add_tweet, tweet)
        
                # Also add to event
                tweetInEvent = {'Tweet_ID': data['id'], 'Event_ID': collection['id']}
                cursor.execute(add_tweet_to_event, tweetInEvent)
             
    if(not options.test):
        serverStorage.commit()
    cursor.close()
                
                        
def parseDir(path):
    if options.verbose:
        print ("Parsing All JSON Files in: " + path)
    
    for filename in sorted(os.listdir(path)):
        if filename.endswith(".json") and filename[-18:-10].isdigit() and filename[-9:-5].isdigit():
            parseFile(path + "/" + filename)

def verifyCollection(collection_name):
    if collection['name'] == None:
        if options.verbose: print ("    Processing new collection")
        loadCollection(collection_name)
    elif collection['name'] == collection_name:
        # Just add to it then
        pass
    else:
        if options.verbose: print ("    Saving old collection and writing new one")
        saveCollection()
        loadCollection(collection_name)
        
def loadCollection(collection_name):
    global collection
    
    if(serverCapture is None):
        connectToServer();
    
    # Find the right connection
    found = False
    pgno = 1
    while(found is False):
        fetched_data = serverCapture.doSimpleJSONGet('jobs/?format=json&page=' + str(pgno))
        
        # Search for collection in the fetched data
        for item in fetched_data["results"]:
            if(item["name"] == collection_name):
                collection = item
                found = True
                break
        
        
        if (fetched_data["next"] is None):
            break
        
        # Not found, continue searching through the next pages
        pgno += 1
    
    keywords = collection["twitter_keywords"].split(',');
    
#    if("Paris" in collection["name"]):
#        keywords.append("Les Halles")
#        keywords.append("Shopping Mall")
#        keywords.append("Concert Hall")
#        keywords.append("Uber")
#        keywords.append("Eiffel")
#        keywords.append("Gamergate")
#    print(keywords)
    
    collection["keywords"] = []
    collection["keywords_parts"] = []
    
    for keyword in keywords:
        keyword = keyword.strip()
        collection["keywords"].append(keyword)
        
        keywords_parts = unicodedata.normalize('NFKD', keyword.lower().replace('#', '')).split(' ')
        collection["keywords_parts"].append(keywords_parts)
    
def saveCollection():
    pass

def connectToServer():
    if(options.verbose): print("    Connecting to Captures Database")
    
    with open('../local.conf') as config_file:
        global serverCapture
        config = json.load(config_file)
        
        serverCapture = ServerMessenger(
            base_url = config["server"]["base_url"],
            token = config["server"]["token"]
        )
        
        # MySQL Storage
        global serverStorage
        if(options.database):
            config["storage"]["database"] = options.database
        
        serverStorage = mysql.connector.connect(
            user=config["storage"]["user"],
            password=config["storage"]["password"],
            host=config["storage"]["host"],
            database=config["storage"]["database"]
        )

if __name__ == "__main__":
    main()
