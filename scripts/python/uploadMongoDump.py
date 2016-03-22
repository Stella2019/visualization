import codecs, re, sys
import parse_raw_JSON
import uploadCodes
import mysql.connector
import json
from pprint import pprint

# Parameters
period = 1;

#files = ['airspace', 'flag', 'hadley', 'lakemba', 'suicide_belts'] # Sydney Siege
#rumor_i = 1;
#folder = 'Sydney Siege'
#filename = files[rumor_i]
#rumor_id = rumor_i + 8;

files = ['sunil', 'navy_seals', 'proposal', 'girl_running'] # Boston
folder = 'Boston'
event_id = -6
rumor_i = 0
rumor_id = rumor_i + 24
filename = files[rumor_i]

#folder = 'Tianjin Explosion'
#filename = 'china_pentagon' # Tianjin Explosion
#rumor_id = 28

#folder = 'Paris Attacks'
#filename = 'les_halles'
#rumor_id = 29

filename = '..\\..\\..\\dav\\' + folder + '\\' + filename + '.json'
config_file = '..\\..\\local.conf'

#['boston', 'marathon', 'bombing', 'finish line', 'race', 'sunil', 'tripathi', 'girl', 'navy seals', 'propose', 'proposal', 'girlfriend', 'sandy hook', 'falseflag', 'false flag', 'hoax', 'crisis actor', 'crisis actors'],
#['Tianjin explosion', 'china explosion', 'petrol station explosion', 'binhai explosion', 'binhai', 'oil explosion', 'tianjin', 'gas explosion', 'Tianjin blast', 'TianjinBlast', 'incinerated', 'explosives detonate', 'shipment explosion', 'explosives detonation', 'explosives detonated', 'Tianhe']

# Setup Collection
collection = {
    'id': event_id,
    'keywords': [],
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
        line = re.sub(r'$oid', 'oid', line)
        line = re.sub(r'ObjectId\([a-z0-9" ]+\)', '0', line)
        line = re.sub(r'Date\( ([0-9]+) \)', r'\1', line)
        try:
            tweet = parse_raw_JSON.parseTweetJSON(line)
        except: 
            print("Unexpected error:", sys.exc_info()[0])
            print(parse_raw_JSON.rm_unicode(line[:100]))
            continue
            
        tweet['FoundIn'] = ''
#        parse_raw_JSON.printNested(tweet)
        
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
            'Rumor_ID': rumor_id
        }
        cursor.execute(
            parse_raw_JSON.query_add_tweet_to_event,
            tweetInCollection)
        cursor.execute(
            query_add_tweet_to_rumor,
            tweetInCollection)

        # Also add codes
        raw_json = json.loads(line)
        if('codes' in raw_json and len(raw_json['codes']) > 0):
            codes = raw_json['codes'][0]
            if('first_code' in codes):
                code = {
                    'Tweet': tweet['ID'],
                    'Text': tweet['Text'],
                    'Coder': 28, # Unknown
                    'Rumor': rumor_id,
                    'Period': period,
                    'Uncodable': codes['first_code'] == 'Uncodable',
                    'Unrelated': codes['first_code'] == 'Unrelated',
                    'Affirm':    codes['first_code'] == 'Affirm',
                    'Deny':      codes['first_code'] == 'Deny',
                    'Neutral':   codes['first_code'] == 'Neutral',
                    'Implicit':    'Implicit'    in codes['second_code'],
                    'Ambiguity':   'Ambiguity'   in codes['second_code'],
                    'Uncertainty': 'Uncertainty' in codes['second_code'],
                    'Difficult':   'Difficult'   in codes['second_code']
                }
                cursor.execute(uploadCodes.query_push_code, code)
            
serverStorage.commit()
cursor.close()
