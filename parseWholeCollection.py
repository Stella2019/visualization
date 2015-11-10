import json, os, csv, pprint

computer = "twcap"

with open('collections.json') as file:
    collections = json.load(file)
    for collection in collections:
        keywords = collection["keywords"]
        folder = '/var/collect/twcap/data/' + collection["name"] # Boston
        if computer == "twcap":
            folder = '/var/collect/twcap/captures/' + collection["name"] # Twcap
            
        if computer in collection["capture"] and os.path.isdir(folder):
        
            # Calculated Variables
            results = {}
            keywordsf = []
            for keyword in keywords:
                keywordsf.append(keyword.lower().replace('#', ''))

            # Process
            for filename in sorted(os.listdir(folder)):
                if filename[-5:] == '.json' and filename[-18:-10].isdigit() and filename[-9:-5].isdigit():

                    # Make entry for new timestamp
                    timestamp = filename[-18:-5]
                    print filename
                    results[timestamp] = {'tweets': 0}
                    for keyword in keywordsf:
                        results[timestamp][keyword] = 0

                    # Load this time period's JSON file
                    with open(folder + '/' + filename) as data_file: 
                        for line in data_file:
                            if len(line) > 5:
                                data = json.loads(line)
                                text = data['text'].lower().split()

                                results[timestamp]['tweets'] += 1

                                # Search for keywords
                                for keyword in keywordsf:
                                    keyword_parts = keyword.split()
                                    parts_found = 0
                                    for keyword_part in keyword_parts:
                                        if (keyword_part in text) or ("#" + keyword_part in text):
                                            parts_found += 1

                                    if parts_found == len(keyword_parts):
                                        results[timestamp][keyword] += 1

                                text = data['text']
                                
                                results[timestamp]['tweets'] += 1
            
                                # Search for keywords
                                for keyword in keywordsf:
                                    if keyword in text.lower():
                                        results[timestamp][keyword] += 1

            # Write results to comma separated values file
            with open('data/' + collection["name"] + '.csv', 'w') as out_file:
                writer = csv.writer(out_file, delimiter=',')

                # Write column headers
                row = ['timestamp','tweets']
                for keyword in keywords:
                    row.append(keyword.encode('ascii','ignore'))
                writer.writerow(row)

                # Write rows
                for timestamp in sorted(results):
                    row = [timestamp, results[timestamp]['tweets']]
                    for keyword in keywordsf:
                        row.append(results[timestamp][keyword])
                    writer.writerow(row)

# Save the results
#with open(collection["name"] + '.json', 'w') as out_file:
#    json.dump(results, out_file)

# Display results
#import pprint
#pprint.pprint(results)
