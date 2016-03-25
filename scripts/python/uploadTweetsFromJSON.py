#!/usr/bin/env python

import json, os, re, csv, sys, socket
import argparse, unicodedata
from pprint import pprint
from datetime import datetime, timedelta
from server_messenger import ServerMessenger
from utils.TwitterTextRemover import TwitterTextRemover
import mysql.connector

serverCapture = None
serverStorage = None
options = {}
collection = {'name': None}
subsets = []
stripTweetText = TwitterTextRemover()
distinct_set = set()

# Queries
queries = {
    'get_subsets': ("SELECT * FROM Subset "
                  "WHERE Event=%(Event)s AND Rumor=%(Rumor)s AND Superset=%(Superset)s"),
    'add_subset': ("INSERT INTO Subset "
                 "(Event, Rumor, Superset, Feature, `Match`, Notes) "
                 "VALUES (%(Event)s, %(Rumor)s, %(Superset)s, %(Feature)s, %(Match)s, %(Notes)s) "),
    'add_tweet': ("INSERT IGNORE INTO Tweet "
                "(ID, Timestamp, Lang, Text, TextStripped, `Distinct`, "
                "    Type, Source, ParentID, ParentText, ExpandedURL, MediaURL) "
                "VALUES (%(ID)s, %(Timestamp)s, %(Lang)s, %(Text)s, %(TextStripped)s, %(Distinct)s, "
                "    %(Type)s, %(Source)s, %(ParentID)s, %(ParentText)s, %(ExpandedURL)s, %(MediaURL)s) "),
    'add_tweetuser': ("INSERT IGNORE INTO TweetUser "
                "(Tweet, UserID, Username, Screenname, CreatedAt, "
                "    Description, Location, UTCOffset, Timezone, Lang, "
                "    StatusesCount, FollowersCount, FriendsCount, "
                "    ListedCount, FavouritesCount, Verified) "
                "VALUES (%(ID)s, %(UserID)s, %(Username)s, %(Screenname)s, %(UserCreatedAt)s, "
                "    %(UserDescription)s, %(UserLocation)s, %(UserUTCOffset)s, %(UserTimezone)s, %(UserLang)s, "
                "    %(UserStatusesCount)s, %(UserFollowersCount)s, %(UserFriendsCount)s, "
                "    %(UserListedCount)s, %(UserFavouritesCount)s, %(UserVerified)s) "),
    'add_event': ("INSERT INTO Event "
                "(ID, Name, Description, Keywords, OldKeywords, StartTime, StopTime, Server) "
                "VALUES (%(ID)s, %(Name)s, %(Description)s, %(Keywords)s, %(OldKeywords)s, "
                "    %(StartTime)s, %(StopTime)s, %(Server)s) "
                "ON DUPLICATE KEY UPDATE `Keywords`=%(Keywords)s, `OldKeywords`=%(OldKeywords)s, "
                "    `StartTime`=%(StartTime)s, `StopTime`=%(StopTime)s, `Server`=%(Server)s "),
    'add_inevent': ("INSERT INTO InEvent "
                  "(Tweet, Event, Backfill) "
                  "VALUES (%(Tweet)s, %(Event)s, %(Backfill)s) "
                  "ON DUPLICATE KEY UPDATE Backfill=LEAST(Backfill, %(Backfill)s)"),
    'add_insubset': ("INSERT IGNORE INTO InSubset "
                   "(Tweet, Subset) "
                   "VALUES (%(Tweet)s, %(Subset)s) ")
}

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
    parser.add_argument("-t", "--test", action="store_true", default=False,
                        help="Just testing the program, don't commit tweets")
    parser.add_argument("-e", "--events", nargs="+", required=False,
                        help='List event numbers to be grouped into aggregate event')
    parser.add_argument("-c", "--config", required=False, default='../../local.conf',
                        help='Name of configuration file')
    parser.add_argument("-m", "--minimum_date", required=False,
                        help='Minimum date for files to be accepted')
    parser.add_argument("-M", "--maximum_date", required=False,
                        help='Maximum date for files to be accepted')
    parser.add_argument("path", action="store",
                        help="Path to file/folder where the collections are to be processed.")
    global options
    options = parser.parse_args()
    options.database = 'misinfo_analysis'
    
    connectToServer()
    
    if(options.directory):
        parseDir(options.path)
    else:
        parseFile(options.path)

    serverStorage.close()
        
def parseFile(filename):
    
    # Keep track of version of the file
    filename_with_content = filename
    version = 0
    if(filename[-7:-5].isdigit() and filename[-8] == '_'):
        version = int(filename[-7:-5]) + 1
        filename_with_content = filename[:-8] + '.json'
    
#    collection_name = filename_with_content[0:-18].rsplit('/',1)[-1]
    collection_name = filename_with_content[0:-18].rsplit('\\',1)[-1]
    timestamp_str = filename_with_content[-18:-5]
    timestamp = datetime.strptime(timestamp_str, '%Y%m%d_%H%M')
    if(options.minimum_date):
        min_timestamp = datetime.strptime(options.minimum_date, '%Y%m%d_%H%M')
        if(timestamp < min_timestamp):
#            print ("FileTooEarly: " + collection_name + " @ " + timestamp_str)
            return
    if(options.maximum_date):
        max_timestamp = datetime.strptime(options.maximum_date, '%Y%m%d_%H%M')
        if(timestamp >= max_timestamp):
#            print ("FileTooLate : " + collection_name + " @ " + timestamp_str)
            return
    
    if(options.verbose): 
        if(version is not 0):
            print ("Parsing File: " + collection_name + " @ " + timestamp_str + '(' + str(version) + ')')
        else:
            print ("Parsing File: " + collection_name + " @ " + timestamp_str)
    
    # Load intermediate collection
    verifyCollection(collection_name)
    
    # Collect the counts of the keyword for the collection
    cursor = serverStorage.cursor()

    # Load this time period's JSON file
    with open(filename) as data_file: 
        for line in data_file:
            if len(line) > 5:
                tweet = parseTweetJSON(line)
                
                if('Parent' in tweet):
                    parent = parseTweetJSON(tweet['Parent'])
                    uploadTweet(cursor, parent, 1)
            
                uploadTweet(cursor, tweet, 0)
        
        if(not options.test):
            serverStorage.commit()
        cursor.close()
                        
def parseDir(path):
    if options.verbose:
        print ("Parsing All JSON Files in: " + path)
    
    for filename in sorted(os.listdir(path)):
        fn = filename
        version = 0;
        if(fn[-7:-5].isdigit() and fn[-8] == '_'):
            version = int(fn[-7:-5]) + 1
            fn = fn[:-8] + '.json'
        
        if fn.endswith(".json") and fn[-18:-10].isdigit() and fn[-9:-5].isdigit():
            parseFile(path + "/" + filename)

def uploadTweet(cursor, tweet, backfill=0):
    # Remove Fields that confuse mysql.connector and are not used
    matched_subsets  = tweet['Subsets']
    tweet['Subsets'] = None
    tweet['Parent']  = None
    
    # Push tweet's data to database
    cursor.execute(queries['add_tweet'], tweet)
    cursor.execute(queries['add_tweetuser'], tweet)

    # Also add to event
    tweetInEvent = {
        'Tweet': tweet['ID'],
        'Event': collection['id'],
        'Backfill': backfill
    }
    cursor.execute(queries['add_inevent'], tweetInEvent)
    
    # Add tweet to relevant subsets
    for subset in matched_subsets:
        tweetInEvent = {
            'Tweet': tweet['ID'],
            'Subset': subset,
        }
        cursor.execute(queries['add_insubset'], tweetInEvent)
        
def verifyCollection(collection_name):
    if collection['name'] == None:
        if options.verbose: print ("    Processing new collection")
        loadCollection(collection_name)
    elif collection['name'] == collection_name:
        # Just add to it then
        pass
    else:
        if options.verbose: print ("    Saving old collection and writing new one")
        loadCollection(collection_name)
               
def checkKeywords():
    global collection
    
    # Manage Final Keywords
    final_keywords = []
    for keyword in collection["twitter_keywords"].split(','):
        keyword = keyword.lower().replace('#', '').strip()
        if(len(keyword) > 0):
            final_keywords.append(keyword)
    
    # Look through the history of modifications
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
    deleted_keywords = [];
    for mod in modifications:
        if('twitter_keywords' in mod):
            deleted_words.extend(mod['twitter_keywords']['deletions'])
    
    all_keywords = list(final_keywords)
    old_keywords = [];
    for keyword in deleted_keywords:
        keyword = keyword.lower().replace('#', '').strip()
        
        duplicate = False
        for existing_word in all_keywords:
            duplicate |= keyword.lower() == existing_word
        if(not duplicate and keyword):
            old_keywords.append(keyword)
            all_keywords.append(keyword)
    
    # Set lists
    collection["final_keywords"] = ", ".join(final_keywords)  
    collection["old_keywords"]   = ", ".join(old_keywords)    
    collection["keywords"]       = all_keywords
        
def populateSubsets():
    global subsets
    subsets = []
    cursor = serverStorage.cursor()
    
    subset = {
        'ID': 0,
        'Event': collection['id'],
        'Rumor': 0,
        'Superset': 0,
        'Notes': 'Created by uploadTweetsFromJSON.py at ' + datetime.now().strftime('%Y-%m-%d %H:%M')
    }
    
    # Keyword Subsets
    for keyword in collection['keywords']:
        keyword_query = ' & '.join('\W' + x + '\W' for x in keyword.split(' '))
        subset['Feature'] = 'Text'
        subset['Match'] = keyword_query
        subsets.append(subset.copy())
        
    # Major Timezones (Western US, Central US, Eastern US, UTC, Western Europe)
    for timezone in [-28800, 21600, -18000, 0, 3600]:
        subset['Feature'] = 'User.UTCOffset'
        subset['Match'] = str(timezone)
        subsets.append(subset.copy())
    
    # Save
    if(not options.test):
        serverStorage.commit()
    cursor.close()
    
def checkSubsetsAgainstDatabase():
    global subsets
    
    # Get subsets as defined by server
    cursor = serverStorage.cursor()
    event = {
        'Event': collection['id'],
        'Rumor': 0,
        'Superset': 0
    }
    cursor.execute(queries['get_subsets'], event)
    
    # Zip them together
    for dbsubset in dbIterator(cursor):
        dbsubset = {
            'ID': dbsubset[0],
            'Event': dbsubset[1],
            'Rumor': dbsubset[2],
            'Superset': dbsubset[3],
            'Feature': dbsubset[4],
            'Match': dbsubset[5],
            'Notes': dbsubset[6],
        }
        matched = False
        for subset in subsets:
            if (dbsubset['Feature'] == subset['Feature'] and
                dbsubset['Match']   == subset['Match']):
                subset['ID'] = dbsubset['ID']
                subset['Notes'] = dbsubset['Notes']
                matched = True
                break
        if(not matched):
            subsets.append(dbsubset)
        
    
    # Push missing subsets
    for subset in subsets:
        if(subset['ID'] == 0):
            cursor.execute(queries['add_subset'], subset)
    if(not options.test):
        serverStorage.commit()
    
    # Retrieve the new set with the added subsets
    cursor.execute(queries['get_subsets'], event)
    for dbsubset in dbIterator(cursor):
        dbsubset = {
            'ID': dbsubset[0],
            'Event': dbsubset[1],
            'Rumor': dbsubset[2],
            'Superset': dbsubset[3],
            'Feature': dbsubset[4],
            'Match': dbsubset[5],
            'Notes': dbsubset[6],
        }
        matched = False
        for subset in subsets:
            if (dbsubset['Feature'] == subset['Feature'] and
                dbsubset['Match']   == subset['Match']):
                subset['ID'] = dbsubset['ID']
                subset['Notes'] = dbsubset['Notes']
                matched = True
                break
        if(not matched):
            print('?? Strange problem handling subsets missing:')
            pprint(dbsubset)
        
    cursor.close()
        
def loadCollection(collection_name):
    global collection
    
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

    checkKeywords()
    populateSubsets()
    checkSubsetsAgainstDatabase()
    
    # Push the collection to the storage database if it exists
    cursor = serverStorage.cursor()  

    event = {
        'ID': collection["id"],
        'Name': collection["name"],
        'Description': collection["description"],
        'Keywords': collection["final_keywords"],
        'OldKeywords': collection["old_keywords"],
        'Server': socket.gethostname()
    }

    if('first_started' in collection and collection["first_started"]):
        time = collection["first_started"]
        time = datetime.strptime(time, '%Y-%m-%dT%H:%M:%SZ')
        time = time - timedelta(seconds=60*60*8) # UTC to PST
        time = datetime.strftime(time, '%Y-%m-%d %H:%M:%S')
        event['StartTime'] = time
    else:
        event['StartTime'] = None 

    if('archived_date' in collection and collection["archived_date"]):
        time = collection["archived_date"]
        time = datetime.strptime(time, '%Y-%m-%dT%H:%M:%SZ')
        time = time - timedelta(seconds=60*60*8) # UTC to PST
        time = datetime.strftime(time, '%Y-%m-%d %H:%M:%S')
        event['StopTime'] = time
    else:
        event['StopTime'] = None 

    cursor.execute("SET FOREIGN_KEY_CHECKS=0")
    cursor.execute(queries['add_event'], event)
    cursor.execute("SET FOREIGN_KEY_CHECKS=1")

    if(not options.test):
        serverStorage.commit()
    cursor.close()

def connectToServer():
    if(options.verbose): print("    Connecting to Captures Database")
    
    with open(options.config) as config_file:
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
            
def printNested(obj, level=0):
    if(type(obj) is dict):
        for key in obj:
            if(type(obj[key]) is str):
                text = rm_unicode(obj[key]);
                print("  " * level + key + ": " + text)
            elif(type(obj[key]) is int or type(obj[key]) is bool or not obj[key]):
                text = str(obj[key]);
                print("  " * level + key + ": " + text)
            else:
                print("  " * level + key + ":")
                printNested(obj[key], level + 1)
    elif(type(obj) is list):
        for i, item in enumerate(obj):
            if(type(item) is str):
                text = rm_unicode(item);
                print("  " * level + str(i) + ": " + text)
            elif(type(item) is int or type(item) is bool or not item):
                text = str(item);
                print("  " * level + str(i) + ": " + text)
            else:
                print("  " * level + str(i) + ":")
                printNested(item, level + 1)
    elif(type(obj) is str):
        text = rm_unicode(obj);
        print('  ' * level + text)
    else:
        text = rm_unicode(str(obj));
        print('  ' * level + text)
        
def printNestedWithKeywords(obj, pre="  "):
    if(type(obj) is dict):
        for key in obj:
            if(type(obj[key]) is str):
                text = rm_unicode(obj[key]);
                if(hasKeywords(text)):
                    print(pre + "." + key + ": " + text)
            elif(type(obj[key]) is int or type(obj[key]) is bool or not obj[key]):
                text = str(obj[key]);
                if(hasKeywords(text)):
                    print(pre + "." + key + ": " + text)
            else:
                printNestedWithKeywords(obj[key], pre + '.' + key)
    elif(type(obj) is list):
        for i, item in enumerate(obj):
            if(type(item) is str):
                text = rm_unicode(item);
                if(hasKeywords(text)):
                    print(pre + '[' + str(i) + "]: " + text)
            elif(type(item) is int or type(item) is bool or not item):
                text = str(item);
                if(hasKeywords(text)):
                    print(pre + '[' + str(i) + "]:" + text)
            else:
                printNestedWithKeywords(item, pre + '[' + str(i) + ']')                
                
    elif(type(obj) is str):
        text = rm_unicode(obj);
        if(hasKeywords(text)):
            print(pre + ": " + text)
    else:
        text = rm_unicode(str(obj));
        if(hasKeywords(text)):
            print(pre + ": " + text)
        
def hasKeywords(text):
    text = text.lower()
    found = []
    
    if(collection and 'keywords' in collection):
        for keyword, keyword_parts in zip(collection['keywords'], collection['keywords_parts']):
            parts_found = 0
            for keyword_part in keyword_parts:
                if (re.search('\\b' + keyword_part + '\\b', text)):
                    parts_found += 1

            if parts_found == len(keyword_parts):
                found.append(keyword)
                
    return found

def getExpandedURL(data):
    if('entities' in data and 'urls' in data['entities'] and len(data['entities']['urls']) > 0 and 'expanded_url' in data['entities']['urls'][0]):
        return data['entities']['urls'][0]['expanded_url']
    return None

def getMediaURL(data):
    if('entities' in data and 'media' in data['entities'] and len(data['entities']['media']) > 0 and 'media_url' in data['entities']['media'][0]):
        return data['entities']['media'][0]['media_url']
    return None

def l_unique(a):
    return list(set(a))
def l_intersect(a, b):
    return list(set(a) & set(b))
def l_union(a, b):
    return list(set(a) | set(b))

def compareSubsets(data):    
    matched_subsets = []
    
    for subset in subsets:
        if(subset['Feature'] in ['Text', 'ExpandedURL', 'ParentText']):
            text = data[subset['Feature']].lower().replace('#', ' ')
            keywords = subset['Match'].replace('\\W', '\\W').split(' & ')
            for keyword in keywords:
                if(re.search(keyword, text)):
                    matched_subsets.append(subset['ID'])
                    break
        elif(subset['Feature'] == 'User.UTCOffset'):
            feat = data['UserUTCOffset']
            if(str(feat) == subset['Match']):
                matched_subsets.append(subset['ID'])
       
    return matched_subsets

def parseTweetJSON(data):
    if(type(data) is str):
        data = json.loads(data)
    text = data['text']

    # Strip text of tweet for basic form of text without URLs, user mentions, etc.
    text_stripped = stripTweetText.strip(text)
    text_stripped = re.sub('\s+', ' ', text_stripped).strip()

    # Figure out if the tweet is distinct
    distinct = 0
    if(text_stripped not in distinct_set):
        distinct_set.add(text_stripped)
        distinct = 1
        
    # Get attributes of tweet
    id_timestamp = int(data['id']) / pow(2,22) + 1288834974657
    created_at = datetime.fromtimestamp(id_timestamp / 1000)
    timestamp_exact = datetime.strftime(created_at, '%Y-%m-%d %H:%M:%S')

    tweet = {
        'ID': data['id'],
        'Text': text,
        'TextStripped': text_stripped,
        'Distinct': distinct,
        'Type': 'original',
        'Timestamp': timestamp_exact,
        'ParentID': None,
        'ParentText': None,
        'ExpandedURL': getExpandedURL(data),
        'MediaURL': getMediaURL(data),
        'Lang': data['lang'] if 'lang' in data else None,
        'Source': data['source'] if 'source' in data else None,
        'UserID': None,
        'Username': None,
        'Screenname': None,
        'UserCreatedAt': None,
        'UserDescription': None,
        'UserLocation': None,
        'UserUTCOffset': None,
        'UserTimezone': None,
        'UserLang': None,
        'UserStatusesCount': None,
        'UserFollowersCount': None,
        'UserFriendsCount': None,
        'UserListedCount': None,
        'UserFavouritesCount': None,
        'UserVerified': None
    }

    # Type specific changes
    if("quoted_status_id_str" in data and data['quoted_status_id_str'] is not None): 
        tweet['Type'] = 'quote'
        
        tweet['ParentID'] = data['quoted_status_id_str']
        if('quoted_status' in data):
            if(tweet['ExpandedURL'] is None):
                tweet['ExpandedURL'] = getExpandedURL(data['quoted_status'])
                
            if('text' in data['quoted_status']):
                tweet['ParentText'] = data['quoted_status']['text']
    elif("in_reply_to_status_id_str" in data and data['in_reply_to_status_id_str'] is not None): 
        tweet['Type'] = 'reply'
        
        tweet['ParentID'] = data['in_reply_to_status_id_str']
        if(tweet['ExpandedURL'] is None):
            tweet['ExpandedURL'] = getExpandedURL(data)
        # AFAIK no record of tweet being replied to is available
    elif("retweeted_status" in data and (data['retweeted_status']) is not None):
        tweet['Type'] = 'retweet'
        
        tweet['Parent'] = data['retweeted_status']
        if(tweet['ExpandedURL'] is None):
            tweet['ExpandedURL'] = getExpandedURL(data['retweeted_status'])
            
        if('id' in data['retweeted_status']):
            tweet['ParentID'] = data['retweeted_status']['id']
        if('text' in data['retweeted_status']):
            tweet['ParentText'] = data['retweeted_status']['text']
    else:
        tweet['ExpandedURL'] = getExpandedURL(data)
        
    # Users
    if("user" in data):
        user = data['user']
        tweet['UserVerified']       = 1                        if 'verified' in user and user['verified'] else 0
        tweet['UserID']             = user['id_str']           if 'id_str'   in user else None
        tweet['Username']           = user['name']             if 'name'     in user else None
        tweet['Screenname']         = user['screen_name']      if 'screen_name' in user else None
        tweet['UserLang']           = user['lang']             if 'lang'        in user else None
        tweet['UserUTCOffset']      = user['utc_offset']       if 'utc_offset'  in user else None
        tweet['UserTimezone']       = user['time_zone']        if 'time_zone'   in user else None
        tweet['UserStatusesCount']  = user['statuses_count']   if 'statuses_count' in user else None
        tweet['UserFollowersCount'] = user['followers_count']  if 'followers_count' in user else None
        tweet['UserFriendsCount']   = user['friends_count']    if 'friends_count'   in user else None
        tweet['UserListedCount']    = user['listed_count']     if 'listed_count'    in user else None
        tweet['UserFavoritesCount'] = user['favourites_count'] if 'favourites_count' in user else None
        tweet['UserDescription']    = user['description']      if 'description'      in user else None
        tweet['UserLocation']       = user['location']         if 'location'         in user else None
        
        if('created_at' in user):
            created_at = datetime.strptime(user['created_at'], '%a %b %d %H:%M:%S %z %Y') # Not guaranteed to save timezone info
            created_at = datetime.strftime(created_at, '%Y-%m-%d %H:%M:%S')
            tweet['UserCreatedAt'] = created_at
        
        tweet['UserDescription'] = tweet['UserDescription'].replace('\n', ' ') if tweet['UserDescription'] else None
        tweet['UserLocation']    = tweet['UserLocation'].replace('\n', ' ')    if tweet['UserLocation']    else None
                
        if(tweet['UserTimezone'] and len(tweet['UserTimezone']) > 20):
            tweet['UserTimezone'] = tweet['UserTimezone'][:20]
        if(tweet['UserLang']     and len(tweet['UserLang']) > 10):
            tweet['UserLang']     = tweet['UserLang'][:10]
        if(tweet['Screenname']   and len(tweet['Screenname']) > 45):
            tweet['Screenname'],  = tweet['Screenname'][:45]
            

    # Search for keywords
    tweet['Subsets'] = compareSubsets(tweet)
    
    return tweet

def camelCase(s):
    return "".join(x.title() for x in s.split('_'))

def rm_unicode(str):
    return str.encode('ascii', 'ignore').decode('ascii', 'ignore') # or replace
def norm_unicode(str):
    return rm_unicode(unicodedata.normalize('NFD', str))
def setCollection(new_collection):
    global collection
    collection = new_collection
def dbIterator(cursor, arraysize=1000):
    # 'An iterator that uses fetchmany to keep memory usage down'
    while True:
        results = cursor.fetchmany(arraysize)
        if not results:
            break
        for result in results:
            yield result

if __name__ == "__main__":
    main()
