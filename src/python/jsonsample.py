#!/usr/bin/env python

import json, os, re, csv, sys, socket
import argparse, unicodedata, random
from pprint import pprint
from datetime import datetime, timedelta
import parse_raw_JSON

options = {
    'verbose': True,
    'minimum_date': '20160226_0300',
    'maximum_date': '20160227_0300',
    'directory': True,
    'path': '../../../dav/Black History Month Tail End',
    'sample': 1000
}

fields = ['ID', 'Text', 'TextStripped', 'Distinct', 'Type', 'Timestamp', 'TimestampMinute', 'Origin', 'ExpandedURL', 'MediaURL', 'MediaURL2', 'QuotedText', 'Lang', 'Source', 'UserID', 'UserName', 'ScreenName', 'UserCreatedAt', 'UserDescription', 'UserLocation', 'UserUTCOffset', 'UserTimeZone', 'UserLang', 'UserStatusesCount', 'UserFollowersCount', 'UserFriendsCount', 'UserListedCount', 'UserFavouritesCount']
tweets = {'blm': [], 'bhm': [], 'alm': []}

def main():
    
    if(options['directory']):
        parseDir(options['path'])
    else:
        parseFile(options['path'])
    saveCollection('bhm')
    saveCollection('blm')
    saveCollection('alm')
        
def parseFile(filename):
    
    # Keep track of version of the file
    filename_with_content = filename
    version = 0
    if(filename[-7:-5].isdigit() and filename[-8] == '_'):
        version = int(filename[-7:-5]) + 1
        filename_with_content = filename[:-8] + '.json'
    
    collection_name = filename_with_content[0:-18].rsplit('/',1)[-1]
    timestamp_str = filename_with_content[-18:-5]
    file_minute = int(timestamp_str[-2:])
    timestamp = datetime.strptime(timestamp_str, '%Y%m%d_%H%M')
    if(options['minimum_date']):
        min_timestamp = datetime.strptime(options['minimum_date'], '%Y%m%d_%H%M')
        if(timestamp < min_timestamp):
#            print ("FileTooEarly: " + collection_name + " @ " + timestamp_str)
            return
    if(options['maximum_date']):
        max_timestamp = datetime.strptime(options['maximum_date'], '%Y%m%d_%H%M')
        if(timestamp >= max_timestamp):
#            print ("FileTooLate : " + collection_name + " @ " + timestamp_str)
            return
    
    if(options['verbose']): 
        if(version is not 0):
            print ("Parsing File: " + collection_name + " @ " + timestamp_str + '(' + str(version) + ')')
        else:
            print ("Parsing File: " + collection_name + " @ " + timestamp_str)

    # Load this time period's JSON file
    with open(filename) as data_file: 
        for line in data_file:
            if len(line) > 5:
#                line2 = parse_raw_JSON.norm_unicode(line)
#                line2 = parse_raw_JSON.rm_unicode(line2)
                tweet = parse_raw_JSON.parseTweetJSON(line)
                del tweet['FoundIn']
        
                if('blacklivesmatter' in tweet['Text'].lower()):
                    tweets['blm'].append(tweet)
                if('alllivesmatter' in tweet['Text'].lower()):
                    tweets['alm'].append(tweet)
                if('blackhistorymonth' in tweet['Text'].lower()):
                    tweets['bhm'].append(tweet)
                
def saveCollection(subset):
    sampled_tweets = random.sample(tweets[subset], options['sample']);
    filename = options['path'] + '/' + 'BlackHistoryMonth_20160226_' + subset
    
    with open(filename + '.json', 'w') as outfile:
        json.dump(sampled_tweets, outfile)
    
    with open(filename + '.csv', 'w', newline='') as outfile:
        writer = csv.DictWriter(outfile, fields)
        writer.writeheader()
        for tweet in sampled_tweets:
            for field in fields:
                if(tweet[field] == None):
                    tweet[field] = ''
                tweet[field] = str(tweet[field]).replace('\n', '')
            
#            parse_raw_JSON.printNested(tweet)
#            pprint(tweet)
            writer.writerow(tweet)
                
def parseDir(path):
    if options['verbose']:
        print ("Parsing All JSON Files in: " + path)
    
    for filename in sorted(os.listdir(path)):
        fn = filename
        version = 0;
        if(fn[-7:-5].isdigit() and fn[-8] == '_'):
            version = int(fn[-7:-5]) + 1
            fn = fn[:-8] + '.json'
        
        if fn.endswith(".json") and fn[-18:-10].isdigit() and fn[-9:-5].isdigit():
            parseFile(path + "/" + filename)

if __name__ == "__main__":
    main()
