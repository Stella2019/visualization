#!/usr/bin/env python

import json, os, csv
import argparse, sys, unicodedata
from pprint import pprint
import requests
from server_messenger import ServerMessenger

server = None;
options = {};
collection = {'name': None};
collection_counts = {};

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
    
    collection_counts[timestamp] = {'tweets': 0}
    for keyword in collection['keywords']:
        collection_counts[timestamp][keyword] = 0

    # Load this time period's JSON file
    with open(filename) as data_file: 
        for line in data_file:
            if len(line) > 5:
                data = json.loads(line)
                text = data['text'].lower().split()

                collection_counts[timestamp]['tweets'] += 1

                # Search for keywords
                for keyword, keyword_parts in zip(collection['keywords'], collection['keywords_parts']):
                    parts_found = 0
                    for keyword_part in keyword_parts:
                        if (keyword_part in text) or ("#" + keyword_part in text):
                            parts_found += 1

                    if parts_found == len(keyword_parts):
                        collection_counts[timestamp][keyword] += 1
                        
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
        
        if (fetched_data is None):
            return
        
        # Search for collection in the fetched data
        for item in fetched_data["results"]:
            if(item["name"] == collection_name):
                collection = item
                found = True
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
    
def saveCollection():
    # Write results to comma separated values file
    with open('../capture_stats/' + collection["name"] + '.csv', 'w') as out_file:
        writer = csv.writer(out_file, delimiter=',')
        
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


#computer = "twcap"
#
#with open('collections.json') as file:
#    collections = json.load(file)
#    for collection in collections:
#        keywords = collection["keywords"]
#        folder = '/var/collect/twcap/data/' + collection["name"] # Boston
#        if computer == "twcap":
#            folder = '/var/collect/twcap/captures/' + collection["name"] # Twcap
#            
#        if computer in collection["capture"] and os.path.isdir(folder):
#        
#            # Calculated Variables
#            results = {}
#            keywordsf = []
#            for keyword in keywords:
#                keywordsf.append(unicodedata.normalize('NFKD', keyword.lower().replace('#', '')))
#
#            # Process
#            for filename in sorted(os.listdir(folder)):
#                if filename[-5:] == '.json' and filename[-18:-10].isdigit() and filename[-9:-5].isdigit():
#
#                    # Make entry for new timestamp
#                    timestamp = filename[-18:-5]
#                    print filename
#                    results[timestamp] = {'tweets': 0}
#                    for keyword in keywordsf:
#                        results[timestamp][keyword] = 0
#
#                    # Load this time period's JSON file
#                    with open(folder + '/' + filename) as data_file: 
#                        for line in data_file:
#                            if len(line) > 5:
#                                data = json.loads(line)
#                                tfext = data['text'].lower().split()
#
#                                results[timestamp]['tweets'] += 1
#
#                                # Search for keywords
#                                for keyword in keywordsf:
#                                    keyword_parts = keyword.split()
#                                    parts_found = 0
#                                    for keyword_part in keyword_parts:
#                                        if (keyword_part in text) or ("#" + keyword_part in text):
#                                            parts_found += 1
#
#                                    if parts_found == len(keyword_parts):
#                                        results[timestamp][keyword] += 1
#
#                                text = data['text']
#                                
#                                results[timestamp]['tweets'] += 1
#            
#                                # Search for keywords
#                                for keyword in keywordsf:
#                                    if keyword in text.lower():
#                                        results[timestamp][keyword] += 1
#
#            # Write results to comma separated values file
#            with open('data/' + collection["name"] + '.csv', 'w') as out_file:
#                writer = csv.writer(out_file, delimiter=',')
#
#                # Write column headers
#                row = ['timestamp','tweets']
#                for keyword in keywords:
#                    row.append(keyword.encode('ascii','ignore'))
#                writer.writerow(row)
#
#                # Write rows
#                for timestamp in sorted(results):
#                    row = [timestamp, results[timestamp]['tweets']]
#                    for keyword in keywordsf:
#                        row.append(results[timestamp][keyword])
#                    writer.writerow(row)
#
## Save the results
##with open(collection["name"] + '.json', 'w') as out_file:
##    json.dump(results, out_file)
#
## Display results
##import pprint
##pprint.pprint(results)
