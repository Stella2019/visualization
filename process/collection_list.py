#!/usr/bin/env python

import json, os, csv
import argparse, sys, unicodedata
from pprint import pprint
import requests
from server_messenger import ServerMessenger


def main():
    
    connectToServer();
    collections = [];
    
    # Iterate through the database
    url = 'jobs/?format=json';
    while(True):
        print(url)
        fetched_data = server.doSimpleJSONGet(url)
        
        # Search for collection in the fetched data
        for item in fetched_data["results"]:
            item["keywords"] = item["twitter_keywords"].replace(', ', ',').split(',')
            item["has_stats"] = os.path.exists("../capture_stats/" + item["name"] + ".csv")
            if(item["total_count"] is not None and item["total_count"] > 1000):
                collections.append(item)
        
        if(fetched_data["next"] is None):
            break
        else:
            url = '/'.join(fetched_data["next"].split('/')[-2:])
            
    # Write collection list to a json file
    with open('../capture_stats/collections.json', 'w') as out_file:
        json.dump(collections, out_file)

def connectToServer():
    
    with open('../local.conf') as config_file:
        global server
        config = json.load(config_file)
        
        server = ServerMessenger(
            base_url = config["server"]["base_url"],
            token = config["server"]["token"]
        )

if __name__ == "__main__":
    main()
