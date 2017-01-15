import json, csv
import mysql.connector

# Connect to server
config_file = '../../local.conf'
config = json.load(open(config_file))
storage = mysql.connector.connect(
    user=config["storage"]["user"],
    password=config["storage"]["password"],
    host=config["storage"]["host"],
    database=config["storage"]["database"]
)
cursor = storage.cursor(dictionary=True)

# Do we need to get user information?
nodelist_file = '/Users/conra/Documents/UWashington/Misinfo/Shooting Narrative Graphs/Graph CN 15719/shootingCN_nodelist.csv'
nodelist = csv.DictReader(open(nodelist_file, 'r'))
ids = []
for row in nodelist:
    ids.append(row['ID'])
    
# Get Shared Audience Edges from old file
edgelist_file = '/Users/conra/Documents/UWashington/Misinfo/Shooting Narrative Graphs/Graph CN 15719/shootingCN_edgelist_sharedaudience_0p05.csv'
edgelist = csv.DictReader(open(edgelist_file, 'r'))
query = ("INSERT IGNORE INTO SharedAudience "
        "(UserID1, UserID2, WeightCorrected25k) "
        "VALUES (%(Source)s, %(Target)s, %(Weight)s)")

for row in edgelist:
    cursor.execute(query, row)
    storage.commit()



cursor.close();
storage.close();