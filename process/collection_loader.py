#!/usr/bin/env python

import json, os, csv, sys
import argparse, unicodedata
from pprint import pprint
from datetime import datetime
from server_messenger import ServerMessenger

server = None
options = {}
collection = {'name': None}
collection_counts = {}
collection_counts_unique = {}
collection_tweets = {}
unique_mask = 1e6

def main():
    parser = argparse.ArgumentParser(description='Parse a raw collection into the important constituents and/or calculate statistics on the collection',
                                add_help=True)
    parser.add_argument("-v", "--verbose", help="Increase output verbosity",
                    action="store_true")
    parser.add_argument("-d", "--directory", help="Indicates that the path is pointing to a folder, should handle read all json files within", action="store_true")
    parser.add_argument("-s", "--statistics", help="Instead of parsing a raw collection, instead just calculate statistics based on a the file(s)", action="store_true")
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
    
        
def parseFile(filename):
    if(options.verbose): print ("Parsing File: " + filename)

    collection_name = filename[0:-18].rsplit('/',1)[-1]
    timestamp = filename[-18:-5]
    
    # Load intermediate collection
    verifyCollection(collection_name)
    
    # Collect the counts of the keyword for the collection
    global collection_counts
    global collection_counts_unique
    unique_set = set()
    
    collection_counts[timestamp] = {'tweets': 0}
    collection_counts_unique[timestamp] = {'tweets': 0}
    for keyword in collection['keywords']:
        collection_counts[timestamp][keyword] = 0
        collection_counts_unique[timestamp][keyword] = 0

    # Load this time period's JSON file
    with open(filename) as data_file: 
        for line in data_file:
            if len(line) > 5:
                data = json.loads(line)
                text = unicodedata.normalize('NFKD', data['text']);
                
                hash_value = hash(text) % unique_mask
                unique = False
                if(hash_value not in unique_set):
                    unique_set.add(hash_value)
                    unique = True
#                    created_at = datetime.strptime(data['created_at'], '%a %b %d %X %z %Y')
#                    
#                    tweet_reduced = {
#                        'timestamp':  datetime.strftime(created_at, '%y%m%d %H%M%S'),
#                        'text': text
#                        }
#                    collection_tweets[data['id_str']] = tweet_reduced
                    
                text = text.lower().split()

                collection_counts[timestamp]['tweets'] += 1
                if(unique):
                    collection_counts_unique[timestamp]['tweets'] += 1

                # Search for keywords
                for keyword, keyword_parts in zip(collection['keywords'], collection['keywords_parts']):
                    parts_found = 0
                    for keyword_part in keyword_parts:
                        if (keyword_part in text) or ("#" + keyword_part in text):
                            parts_found += 1

                    if parts_found == len(keyword_parts):
                        collection_counts[timestamp][keyword] += 1
                        if(unique):
                            collection_counts_unique[timestamp][keyword] += 1
                        
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
    
    if(server is None):
        connectToServer();
    
    # Find the right connection
    found = False
    pgno = 1
    while(found is False):
        fetched_data = server.doSimpleJSONGet('jobs/?format=json&page=' + str(pgno))
        
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
    
    if("Paris" in collection["name"]):
        keywords.append("Les Halles")
        keywords.append("Shopping Mall")
        keywords.append("Concert Hall")
        keywords.append("Uber")
        keywords.append("Eiffel")
        keywords.append("Gamergate")
    print(keywords)
    
    collection["keywords"] = []
    collection["keywords_parts"] = []
    
    for keyword in keywords:
        keyword = keyword.strip()
        collection["keywords"].append(keyword)
        
        keywords_parts = unicodedata.normalize('NFKD', keyword.lower().replace('#', '')).split(' ')
        collection["keywords_parts"].append(keywords_parts)
        
    # If files exist, load them
    global collection_counts
    global collection_counts_unique
    
    prefix = '../capture_stats/' + collection["name"];
    # Write results to file
    if(os.path.isfile(prefix + '.json')):
        with open(prefix + '.json', 'r') as out_file:
            collection_counts = json.load(out_file)
    else:
        collection_counts = {}
        
    if(os.path.isfile(prefix + '_unique.json')):
        with open(prefix + '_unique.json', 'r') as out_file:
            collection_counts_unique = json.load(out_file)
    else:
        collection_counts_unique = {}
        
#    if(os.path.isfile(prefix + '_tweets.json')):
#        with open(prefix + '_tweets.json', 'r') as out_file:
#            collection_tweets = json.load(out_file)
#    else:
#        collection_tweets = {}
    
def saveCollection():
    prefix = '../capture_stats/' + collection["name"];
    # Write results to file
    with open(prefix + '.json', 'w') as out_file:
        json.dump(collection_counts, out_file)
    with open(prefix + '_unique.json', 'w') as out_file:
        json.dump(collection_counts_unique, out_file)
#    with open(prefix + '_tweets.json', 'w') as out_file:
#        json.dump(collection_tweets, out_file)

def connectToServer():
    if(options.verbose): print("    Connecting to Captures Database")
    
    with open('../local.conf') as config_file:
        global server
        config = json.load(config_file)
        
        server = ServerMessenger(
            base_url = config["server"]["base_url"],
            token = config["server"]["token"]
        )

if __name__ == "__main__":
    main()
