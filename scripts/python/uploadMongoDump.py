import codecs, re, sys
import parse_raw_JSON
import mysql.connector
import json

# Parameters
files = ['airspace', 'flag', 'hadley', 'lakemba', 'suicide_belts'];
i_rumor = 4;
filename = '..\\..\\..\\dav\\Sydney Siege\\' + files[i_rumor] + '.json'
config_file = '..\\..\\local.conf'

# Setup Collection
collection = {
    'id': -1,
    'keywords': ['sydneysiege', 'martinplacesiege', 'haron', 'monis', 'haronmonis', 'illridewithyou', 'martinplace', 'Sydney', 'chocolate shop', 'nswpolice', 'prime minister', 'tony abbott', 'john robertson', 'witness', 'lindt', 'siege', 'hostage', 'hostages', 'martin place', 'terrorise', 'terrorize', 'terrorists', 'flag'],
    'keywords_parts': []
}
query_add_tweet_to_rumor = ("INSERT IGNORE INTO TweetInRumor "
             "(Tweet_ID, Rumor_ID)"
             "VALUES (%(Tweet_ID)s, %(Rumor_ID)s)")

for keyword in collection['keywords']:
    keywords_parts = keyword.lower().replace('#', '').split(' ')
    collection["keywords_parts"].append(keywords_parts)
parse_raw_JSON.setCollection(collection)

# Load database
with open(config_file) as config_file:
    config = json.load(config_file)
    serverStorage = mysql.connector.connect(
        user=config["storage"]["user"],
        password=config["storage"]["password"],
        host=config["storage"]["host"],
        database=config["storage"]["database"]
    )
cursor = serverStorage.cursor()

# Procedures
with codecs.open(filename, 'r', 'utf-8') as data_file: 
    for line in data_file:
        if len(line) < 5:
            continue
        line = re.sub(r'ObjectId\([a-z0-9" ]+\)', '0', line)
        line = re.sub(r'Date\( ([0-9]+) \)', r'\1', line)
        try:
            tweet = parse_raw_JSON.parseTweetJSON(line)
        except: 
            print("Unexpected error:", sys.exc_info()[0])
            print(line[:100])
            continue
            
        tweet['FoundIn'] = ''
        #parse_raw_JSON.printNested(tweet)
        
        # Push tweet's data to database=
        cursor.execute(
            parse_raw_JSON.query_add_tweet,
            tweet)
        cursor.execute(
            parse_raw_JSON.query_add_tweet_metadata,
            tweet)

        # Also add to event
        tweetInCollection = {
            'Tweet_ID': tweet['ID'],
            'Event_ID': collection['id'],
            'Rumor_ID': i_rumor + 8
        }
        cursor.execute(
            parse_raw_JSON.query_add_tweet_to_event,
            tweetInCollection)
        cursor.execute(
            query_add_tweet_to_rumor,
            tweetInCollection)
        
serverStorage.commit()
cursor.close()
