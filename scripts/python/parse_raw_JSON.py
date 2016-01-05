#!/usr/bin/env python

import json, os, re, csv, sys
import argparse, unicodedata
from pprint import pprint
from datetime import datetime, timedelta
from server_messenger import ServerMessenger
import mysql.connector

serverCapture = None
serverStorage = None
options = {}
types = ['all', 'distinct', 'original', 'retweet', 'reply'] # omitting quotes for now since Twitter doesn't really use them
collection = {'name': None}
#collection_counts = {}
collection_tweets = {}
minutes = {}

distinct_mask = 1e6

add_tweet = ("INSERT IGNORE INTO Tweet "
             "(ID, Text, `Distinct`, Type, Username, Timestamp, Origin)"
             "VALUES (%(ID)s, %(Text)s, %(Distinct)s, %(Type)s, %(Username)s, %(Timestamp)s, %(Origin)s)")
add_tweet_to_event = ("INSERT IGNORE INTO TweetInEvent "
             "(Tweet_ID, Event_ID)"
             "VALUES (%(Tweet_ID)s, %(Event_ID)s)")
add_event = ("REPLACE INTO Event "
             "(ID, Name, Description, Keywords, OldKeywords, StartTime, StopTime, TweetsCollected)"
             "VALUES (%(ID)s, %(Name)s, %(Description)s, %(Keywords)s, %(OldKeywords)s, %(StartTime)s, %(StopTime)s, %(TweetsCollected)s)")
add_event_tweet_count = ("INSERT IGNORE INTO EventTweetCount "
             "(Event_ID, Time, Keyword, Count, `Distinct`, Original, Retweet, Reply) "
             "VALUES (%(Event_ID)s, %(Time)s, %(Keyword)s, %(Count)s, %(Distinct)s, %(Original)s, %(Retweet)s, %(Reply)s)")

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
                        help="Calculate statistics & save them")
    parser.add_argument("-w", "--words", nargs="+", required=False,
                        help='To filter the tweets that are accepted, a word or list of words in which one of them must be present in the tweet')
    parser.add_argument("-b", "--database", action="store",
                        help="Name of database to use if not one in .conf file")
    parser.add_argument("--pushtweets", action="store_true", default=False,
                        help="Push tweets to the database (otherwise just pushes counts and the event")
    parser.add_argument("-t", "--test", action="store_true", default=False,
                        help="Just testing the program, don't commit tweets")
    parser.add_argument("-e", "--events", nargs="+", required=False,
                        help='List event numbers to be grouped into aggregate event')
    parser.add_argument("path", action="store",
                        help="Path to file/folder where the collections are to be processed.")
    global options
    options = parser.parse_args()
    
    if(options.directory):
        parseDir(options.path)
    else:
        parseFile(options.path)
    saveCollection()

    if(serverStorage is not None):
        serverStorage.close()
        
def parseFile(filename):
    collection_name = filename[0:-18].rsplit('/',1)[-1]
    timestamp_str = filename[-18:-5]
    timestamp = datetime.strptime(timestamp_str, '%Y%m%d_%H%M')
    
    if(options.verbose): print ("Parsing File: " + collection_name + " @ " + timestamp_str)
    
    # Load intermediate collection
    verifyCollection(collection_name)
    
    # Collect the counts of the keyword for the collection
    global collection_counts
    distinct_set = set()
    cursor = {}
    if(options.database):
        cursor = serverStorage.cursor()
    
    # Initialize different types of counts
    if(minutes):
        for count_type in types:
            minutes[count_type][0] = {'_total_': minutes[count_type][10]['_total_']}
            for keyword in collection['keywords']:
                minutes[count_type][0][keyword] = minutes[count_type][10][keyword]
    else:
        for count_type in types:
            minutes[count_type] = {0: {'_total_': 0}}
            for keyword in collection['keywords']:
                minutes[count_type][0][keyword] = 0
    
    for minute in range(1, 11):
        for count_type in types:
            minutes[count_type][minute] = {'_total_': 0}
            for keyword in collection['keywords']:
                minutes[count_type][minute][keyword] = 0

    # Load this time period's JSON file
    with open(filename) as data_file: 
        for line in data_file:
            if len(line) > 5:
                data = json.loads(line)
                text = unicodedata.normalize('NFD', data['text']).encode('ascii', 'ignore');
                
                split_text = str(text).lower().split()
#                split_text = re.sub('[^0-9a-zA-Z]+', ' ', str(text).lower()).split();
                # at some point remove urls (recognized by http)
                
                push_this_tweet = True
                if(options.words):
                    push_this_tweet = False
                    for word in options.words:
                        push_this_tweet |= word.lower() in text.lower().decode()
                
                # Figure out if the tweet is distinct
                hash_value = hash(text) % distinct_mask
                distinct = False
                if(hash_value not in distinct_set):
                    distinct_set.add(hash_value)
                    distinct = True
                
                # Get attributes of tweet
                # Assemble other attributes
                created_at = datetime.fromtimestamp(int(data['timestamp_ms']) / 1000);
                
                timestamp_exact = datetime.strftime(created_at, '%Y-%m-%d %H:%M:%S')
                timestamp_minute = datetime.strftime(created_at, '%Y%m%d_%H%M')
                
                tweet = {
                    'ID': data['id'],
                    'Text': text,
                    'Distinct': distinct,
                    'Type': 'original',
                    'Username': None,
                    'Timestamp': timestamp_exact,
                    'Origin': None
                }
                
                if("in_reply_to_status_id_str" in data and data['in_reply_to_status_id_str'] is not None): 
                    tweet['Origin'] = data['in_reply_to_status_id_str']
                    tweet['Type'] = 'reply'
                elif("quoted_status_id_str" in data and data['quoted_status_id_str'] is not None): 
                    tweet['Origin'] = data['quoted_status_id_str']
                    tweet['Type'] = 'quote'
                elif("retweeted_status" in data and (data['retweeted_status']) is not None):
                    if('id' in data['retweeted_status']):
                        tweet['Origin'] = data['retweeted_status']['id']
                    tweet['Type'] = 'retweet'
                if("user" in data and "screen_name" in data["user"]):
                    tweet['Username'] = data['user']['screen_name']
                
                if(options.printtweets): pprint(tweet)
                
                # Push the tweet onto the database if we are doing that
                if(options.database and options.pushtweets and push_this_tweet):
                    cursor.execute(add_tweet, tweet)
        
                    # Also add to event
                    tweetInEvent = {
                        'Tweet_ID': data['id'],
                        'Event_ID': collection['id']
                    }
                    cursor.execute(add_tweet_to_event, tweetInEvent)
                    
                # Figure out which minte we are at in the file
                minute = 0
                if(timestamp_minute[-2] != timestamp_str[-2]):
                    minute = 10
                else:
                    minute = int(timestamp_minute[-1])
                
                # Count the tweet by its type
                minutes["all"][minute]['_total_'] += 1
                if(distinct):
                    minutes["distinct"][minute]['_total_'] += 1
                if(tweet["Type"] in types):
                    minutes[tweet["Type"]][minute]['_total_'] += 1
                
                # Next, increment counts if the text has the main keywords

                # Search for keywords
                for keyword, keyword_parts in zip(collection['keywords'], collection['keywords_parts']):
                    parts_found = 0
                    for keyword_part in keyword_parts:
                        if (keyword_part in split_text) or ("#" + keyword_part in split_text):
                            parts_found += 1

                    if parts_found == len(keyword_parts):
                        minutes["all"][minute][keyword] += 1
                        if(distinct):
                            minutes["distinct"][minute][keyword] += 1
                        if(tweet["Type"] in types):
                            minutes[tweet["Type"]][minute][keyword] += 1
                        
    if(options.database):
        
        if(options.statistics):
            # Push the numbers for each minute
            for minute in range(10):
                timestamp_minute = timestamp + timedelta(seconds=60*minute)
                time_key = datetime.strftime(timestamp_minute, '%Y%m%d_%H%M')
                timestamp_minute = datetime.strftime(timestamp_minute, '%Y-%m-%d %H:%M')

                keyword = "_total_"
                data = {
                    'Event_ID': collection["id"],
                    'Time': timestamp_minute,
                    'Keyword': keyword,
                    'Count':    minutes["all"][minute][keyword],
                    'Distinct': minutes["distinct"][minute][keyword],
                    'Original': minutes["original"][minute][keyword],
                    'Retweet':  minutes["retweet"][minute][keyword],
                    'Reply':    minutes["reply"][minute][keyword]
                }

                if(data['Count'] > 0):
                    cursor.execute(add_event_tweet_count, data)    

                for keyword in collection['keywords']:
                    data = {
                        'Event_ID': collection["id"],
                        'Time': timestamp_minute,
                        'Keyword': keyword,
                        'Count':    minutes["all"][minute][keyword],
                        'Distinct': minutes["distinct"][minute][keyword],
                        'Original': minutes["original"][minute][keyword],
                        'Retweet':  minutes["retweet"][minute][keyword],
                        'Reply':    minutes["reply"][minute][keyword]
                    }

                    if(data['Count'] > 0):
                        cursor.execute(add_event_tweet_count, data) 
        
        if(not options.test):
            serverStorage.commit()
        cursor.close()
                        
def parseDir(path):
    if options.verbose:
        print ("Parsing All JSON Files in: " + path)
    
#    i = 0
    for filename in sorted(os.listdir(path)):
        if filename.endswith(".json") and filename[-18:-10].isdigit() and filename[-9:-5].isdigit():
            parseFile(path + "/" + filename)
#            
#            i += 1
#            if(i == 2):
#                return

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
        
        
def getKeywords(collection):
    # Find the right connection
    modifications = []
    
    found = False
    pgno = 1
    while(found is False):
        fetched_data = serverCapture.doSimpleJSONGet('jobmodifications/?format=json&page=' + str(pgno))
        
        # Search for collection in the fetched data
        for item in fetched_data["results"]:
            if(item["job_id"] == collection["id"]):
                modifications.append(json.loads(item["changes"]))
        
        if (fetched_data["next"] is None):
            break
        
        # Not found, continue searching through the next pages
        pgno += 1
    
    # Get deleted terms
    deleted_words = [];
    for mod in modifications:
        if('twitter_keywords' in mod):
            deleted_words.extend(mod['twitter_keywords']['deletions'])
            
    all_keywords = collection["twitter_keywords"].split(',')
    old_keywords = [];
    for new_word in deleted_words:
        duplicate = False
        for existing_word in all_keywords:
            duplicate |= new_word.lower() == existing_word.strip().lower()
        if(not duplicate):
            old_keywords.append(new_word)
            all_keywords.append(new_word)
    
    collection["old_keywords"] = ", ".join(old_keywords)
    
    if("Paris" in collection["name"]):
        for new_word in ["Paris", "Les Halles", "Shopping Mall", "Bataclan", "Concert Hall", "Eiffel", "Louvre", "Pimpidou"]:
            duplicate = False
            for existing_word in all_keywords:
                duplicate |= new_word.lower() == existing_word.strip().lower() 
            if(not duplicate):
                all_keywords.append(new_word)
    
    collection["keywords"] = []
    collection["keywords_parts"] = []
    
    for keyword in all_keywords:
        keyword = keyword.strip()
        collection["keywords"].append(keyword)
        
        keywords_parts = unicodedata.normalize('NFD', keyword.lower().replace('#', '')).split(' ')
        collection["keywords_parts"].append(keywords_parts)
    
    return collection
    
def loadCollection(collection_name):
    global collection
    
    if(serverCapture is None):
        connectToServer()
    
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
    
    collection = getKeywords(collection)
    
    # Push the collection to the storage database if it exists
    if(options.database):
        cursor = serverStorage.cursor()  
        
        event = {
            'ID': collection["id"],
            'Name': collection["name"],
            'Description': collection["description"],
            'Keywords': collection["twitter_keywords"],
            'OldKeywords': collection["old_keywords"],
            'TweetsCollected': collection["total_count"]
        }
        
        if('started' in collection and collection["started"]):
            event['StartTime'] = collection["started"].replace("Z", "").replace("T", " ")
        else:
            event['StartTime'] = None 
        
        if('stopped' in collection and collection["stopped"]):
            event['StopTime'] = collection["stopped"].replace("Z", "").replace("T", " ")
        else:
            event['StopTime'] = None 
        
        cursor.execute("SET FOREIGN_KEY_CHECKS=0")
        cursor.execute(add_event, event)
        cursor.execute("SET FOREIGN_KEY_CHECKS=1")
        
        if(not options.test):
            serverStorage.commit()
        cursor.close()

    # If files exist, load them        
    global minutes
    minutes = {}
    
    # Preload files, temporarily disabled, pending new design
#    prefix = '../capture_stats/' + collection["name"];
#    if(os.path.isfile(prefix + '.json')):
#        with open(prefix + '.json', 'r') as out_file:
#            collection_counts = json.load(out_file)
#    else:
#        collection_counts = {}
#        
#    if(os.path.isfile(prefix + '_unique.json')):
#        with open(prefix + '_unique.json', 'r') as out_file:
#            collection_counts_unique = json.load(out_file)
#    else:
#        collection_counts_unique = {}
        
    
def saveCollection():
    prefix = '../../capture_stats/' + collection["name"];
    # Write results to file
#    for count_type in types:
        
#        filename = prefix + '_' + count_type + '.json'
#        if(os.path.isfile(filename)):
#            out_file = open(prefix + '_' + count_type + '.json', 'a')
#        else:
#            out_file = open(prefix + '_' + count_type + '.json', 'w')
#            
#        pprint(out_file)
#            
#        out_file = open(, 'w')
#        with open(prefix + '_' + count_type + '.json', 'w') as out_file:
#            json.dump(collection_counts[count_type], out_file)

def connectToServer():
    if(options.verbose): print("    Connecting to Captures Database")
    
    with open('../../local.conf') as config_file:
        global serverCapture
        config = json.load(config_file)
        
        serverCapture = ServerMessenger(
            base_url = config["server"]["base_url"],
            token = config["server"]["token"]
        )
        
        # MySQL Storage
        if(options.database):
            global serverStorage
            config["storage"]["database"] = options.database

            serverStorage = mysql.connector.connect(
                user=config["storage"]["user"],
                password=config["storage"]["password"],
                host=config["storage"]["host"],
                database=config["storage"]["database"]
            )

if __name__ == "__main__":
    main()
