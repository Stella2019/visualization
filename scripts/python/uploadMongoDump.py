import codecs, re, sys
from uploadTweetsFromJSON import *
#import uploadCodes
import mysql.connector
import json
from pprint import pprint

#mongoexport -h z --db <dbname> --collection <colname> --out <colname>.json

# Parameters
period = 1;

#files = ['airspace', 'flag', 'hadley', 'lakemba', 'suicide_belts'] # Sydney Siege
#rumor_i = 1;
#folder = 'Sydney Siege'
#filename = files[rumor_i]
#rumor_id = rumor_i + 8;

files = ['sunil', 'navy_seals', 'proposal', 'girl_running'] # Boston
folder = 'Boston'
event_id = -1
rumor_i = 3
rumor_id = rumor_i + 1
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

query_add_tweet_to_rumor = ("INSERT IGNORE INTO TweetInRumor "
             "(Tweet_ID, Rumor_ID)"
             "VALUES (%(Tweet_ID)s, %(Rumor_ID)s)")


# Load database
with open(config_file) as config_file:
    config = json.load(config_file)
    connection = mysql.connector.connect(
        user=config["storage"]["user"],
        password=config["storage"]["password"],
        host=config["storage"]["host"],
        database=config["storage"]["database"]
    )
cursor = connection.cursor(dictionary=True)

# Load Collection
collection = {
    'id': event_id,
    'keywords': [],
}
cursor.execute('SELECT * FROM EVENT WHERE ID = %(Event_ID)s;', {'Event_ID': collection['id']})
collection_db = cursor.fetchone();
collection['keywords'] = collection_db['Keywords'].split(', ')
collection['final_keywords'] = collection_db['Keywords'].split(', ')
setCollection(collection)

# Load subsets and add relevant ones
subsets = populateSubsets()
code_subsets = ['Uncodable', 'Codable', 'Unrelated', 'Related', 'Affirm', 'Deny', 'Neutral', 'Uncertainty']
subset = {
    'ID': 0,
    'Event': collection['id'],
    'Rumor': rumor_id,
    'Superset': 0,
    'Notes': 'Created by uploadMongoDump.py at ' + datetime.now().strftime('%Y-%m-%d %H:%M')
}
for code in code_subsets:
    subset['Feature'] = 'Code'
    subset['Match'] = code
    subsets.append(subset.copy());
subset['Rumor'] = 0
subset['Feature'] = 'Rumor'
subset['Match'] = str(rumor_id)
subsets.append(subset.copy());
subsets = checkSubsetsAgainstDatabase(connection=connection)

# Iterate through tweets
n_tweets = 0
with codecs.open(filename, 'r', 'utf-8') as data_file: 
    for line in data_file:
        if len(line) < 5:
            continue
        line = re.sub(r'$oid', 'oid', line)
        line = re.sub(r'ObjectId\([a-z0-9" ]+\)', '0', line)
        line = re.sub(r'Date\( ([0-9]+) \)', r'\1', line)
        
        # Get tweet
        try:
            tweet = parseTweetJSON(line)
        except: 
            print("Unexpected error:", sys.exc_info()[0])
            print(rm_unicode(line[:100]))
            continue
        
        # Upload tweet
        n_tweets += 1
        if(n_tweets % 1000 == 0):
            print(str(n_tweets) + ' tweets')
        uploadTweet(cursor, tweet)
            
        # Add codes
        raw_json = json.loads(line)
        if('codes' in raw_json and len(raw_json['codes']) > 0):
            codes = raw_json['codes'][0]
            if('first_code' in codes):
                primary_code = 'No Code'
                if(codes['first_code'] in ['Uncodable', 'Unrelated', 'Affirm', 'Deny', 'Neutral']):
                    primary_code = codes['first_code'];
                
                code = {
                    'Tweet': tweet['ID'],
                    'Coder': 0, # Unknown
                    'Rumor': rumor_id,
                    'Period': period,
                    'Primary': primary_code,
                    'Uncodable': primary_code == 'Uncodable',
                    'Codable':   primary_code in ['Related', 'Affirm', 'Deny', 'Neutral'],
                    'Unrelated': primary_code == 'Unrelated',
                    'Related':   primary_code in ['Affirm', 'Deny', 'Neutral'],
                    'Affirm':    primary_code == 'Affirm',
                    'Deny':      primary_code == 'Deny',
                    'Neutral':   primary_code == 'Neutral',
                    'Implicit':    'Implicit'    in codes['second_code'],
                    'Ambiguity':   'Ambiguity'   in codes['second_code'],
                    'Uncertainty': 'Uncertainty' in codes['second_code'],
                    'Difficult':   'Difficult'   in codes['second_code']
                }
                
                # Compare against code subsets
                code_subsets = []
                for subset in subsets:
                    if(subset['Feature'] == 'Code' and subset['Rumor'] == rumor_id):
                        if(code[subset['Match']]):
                            code_subsets.append(subset['ID'])
                    if(subset['Feature'] == 'Rumor' and subset['Match'] == str(rumor_id)):
                        code_subsets.append(subset['ID'])
                
                # Add to database
                tweetIn = {
                    'Tweet': tweet['ID'],
                    'Event': collection['id'],
                    'Distinct': tweet['Distinct'],
                    'Type': tweet['Type']
                }
                for subset in code_subsets:
                    tweetIn['Subset'] = subset
                    cursor.execute(queries['add_insubset'], tweetIn)
        
connection.commit()
cursor.close()
