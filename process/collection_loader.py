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
                    created_at = datetime.strptime(data['created_at'], '%a %b %d %X %z %Y')
                    
                    tweet_reduced = {
                        'timestamp':  datetime.strftime(created_at, '%y%m%d %H%M%S'),
                        'text': text
                        }
                    collection_tweets[data['id_str']] = tweet_reduced
                    
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
    collection["keywords"] = []
    collection["keywords_parts"] = []
    
    for keyword in keywords:
        keyword = keyword.strip()
        collection["keywords"].append(keyword)
        
        keywords_parts = unicodedata.normalize('NFKD', keyword.lower().replace('#', '')).split(' ')
        collection["keywords_parts"].append(keywords_parts)
        
    # Set other collection variable containers to 0
    collection_counts_unique = {}
    collection_tweets = []
    
def saveCollection():
    # Write results to comma separated values file
    with open('../capture_stats/' + collection["name"] + '.csv', 'w') as out_file:
        writer = csv.writer(out_file, delimiter=',', lineterminator='\n')
        
        # Write column headers
        row = ['timestamp','tweets']
        for keyword_parts in collection["keywords_parts"]:
            row.append(' '.join(keyword_parts))
        writer.writerow(row)

        # Write rows
        for timestamp in sorted(collection_counts):
            row = [timestamp, collection_counts[timestamp]['tweets']]
            for keyword in collection["keywords"]:
                row.append(collection_counts[timestamp][keyword])
            writer.writerow(row)
            
        
    # Write results (UNIQUE) to comma separated values file
    with open('../capture_stats/' + collection["name"] + '_unique.csv', 'w') as out_file:
        writer = csv.writer(out_file, delimiter=',', lineterminator='\n')
        
        # Write column headers
        row = ['timestamp','tweets']
        for keyword_parts in collection["keywords_parts"]:
            row.append(' '.join(keyword_parts))
        writer.writerow(row)

        # Write rows
        for timestamp in sorted(collection_counts_unique):
            row = [timestamp, collection_counts_unique[timestamp]['tweets']]
            for keyword in collection["keywords"]:
                row.append(collection_counts_unique[timestamp][keyword])
            writer.writerow(row)
            
    # Write tweets
    with open('../capture_stats/' + collection["name"] + '_tweets.json', 'w') as out_file:
        json.dump(collection_tweets, out_file)

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
