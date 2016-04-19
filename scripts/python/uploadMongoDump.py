import codecs, re, sys
from uploadTweetsFromJSON import *
#import uploadCodes
import mysql.connector
import json
from pprint import pprint

#mongoexport -h z --db <dbname> --collection <colname> --out <colname>.json

# User Parameters
db_name = 'Sydney Siege'
rumor_i = 0
period = 1
existing_collection = True
upload_codes = False
upload_inrumor = True

# Databases
mongoDBs = {
    'Boston': {
        'files': ['sunil', 'navy_seals', 'proposal', 'girl_running'],
        'event_id': -1,
        'rumor_offset': 1
    },
    'MH-17': {
        'files': [],
        'event_id': -2,
        'rumor_offset': 
    },
    'Sydney Siege': {
        'files': ['airspace', 'flag', 'hadley', 'lakemba', 'suicide_belts'],
        'event_id': -3,
        'rumor_offset': 10
    },
    'Westjet': {
        'files': ['hijacking', 'blackbox'],
        'event_id': -4,
        'rumor_offset': 8
    },
    'Donetsk Ukraine Explosion': {
        'files': [],
        'event_id': -5,
        'rumor_offset': 9
    },
    'Baltimore': {
        'files': [],
        'event_id': -6,
        'rumor_offset': 10000
    },
    'DC Power Outage': {
        'files': [],
        'event_id': -7,
        'rumor_offset': 10000
    },
    'Paris Attacks': {
        'files': [],
        'event_id': -8,
        'rumor_offset': 10000
    }
    'Navy Shooting': {
        'files': [],
        'event_id': 46,
        'rumor_offset': 10000
    }
    'Umpqua': {
        'files': ['crisis_actors'],
        'event_id': 91,
        'rumor_offset': 10000
    }
}

#folder = 'Tianjin Explosion'
#filename = 'china_pentagon' # Tianjin Explosion
#rumor_id = 28

## Paris Rumors
#files = ['les_halles', 'crisis_actors', 'bot_prediction']
#folder = 'Paris Attacks'
#event_id = -8
#rumor_i = 1
#rumor_id = rumor_i + 5
#filename = files[rumor_i]


# Make variables based on parameters
db = mongoDBs[db_name]
rumor_id = db['rumor_offset'] + rumor_i
filename = db['files'][rumor_i]
event_id = db['event_id']
folder = db_name

filename = '..\\..\\..\\dav\\' + folder + '\\' + filename + '.json'
config_file = '..\\..\\local.conf'
query_tweet_exists = "SELECT * FROM Tweet WHERE ID=%(ID)s"


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
if(upload_codes or upload_inrumor):
    subset = {
        'ID': 0,
        'Event': collection['id'],
        'Rumor': rumor_id,
        'Superset': 0,
        'Notes': 'Created by uploadMongoDump.py at ' + datetime.now().strftime('%Y-%m-%d %H:%M')
    }
    if(upload_codes):
        for code in code_subsets:
            subset['Feature'] = 'Code'
            subset['Match'] = code
            subsets.append(subset.copy());
    if(upload_inrumor):
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
        
        if(existing_collection):
            cursor.execute(query_tweet_exists, {'ID': tweet['ID']})
            exists = cursor.fetchone()
            if(not exists or not exists['ID']):
                continue
        else:
            uploadTweet(cursor, tweet)
            
        # Add codes
        raw_json = json.loads(line)
        if(upload_codes and
           'codes' in raw_json and 
           len(raw_json['codes']) > 0):
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
#                    if(subset['Feature'] == 'Rumor' and subset['Match'] == str(rumor_id)):
#                        code_subsets.append(subset['ID'])
                
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
                    
        if(upload_inrumor):
            code_subsets = []
            for subset in subsets:
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
