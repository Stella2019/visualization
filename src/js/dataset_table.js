function StatusReport() {
    this.connection = new Connection();
    this.ops = new Options(this);
    this.dataset = new CollectionManager(this, {name: 'dataset', flag_sidebar: false});
    this.tooltip = new Tooltip();
    this.modal = new Modal();
    
    this.hierarchy = ['Event Type', 'Event', 'Rumor', 'Feature', 'Subset'];
    this.event_types = {};
    this.event_types_arr = [];
    this.events = {};
    this.events_arr = [];
    this.rumors = {};
    this.rumors_arr = [];
    this.features = {};
    this.features_arr = [];
    this.subsets = {};
    this.subsets_arr = [];
    
    this.quantities = ['Tweets', 'DistinctTweets', 
                       'Originals', 'DistinctOriginals', 'Retweets', 'DistinctRetweets', 
                       'Replies', 'DistinctReplies', 'Quotes', 'DistinctQuotes', 
                       'Minutes'];
}
StatusReport.prototype = {
    init: function() {
        this.setTriggers();
        this.getData();
        this.tooltip.init();
    },
    setTriggers: function() {
        triggers.on('sort_elements', function() { this.clickSort(false, 'maintain_direction'); }.bind(this));
        triggers.on('new_counts',         this.computeAggregates.bind(this));
        triggers.on('update_counts',      this.updateTableCounts.bind(this));
        triggers.on('refresh_visibility', this.setVisibility.bind(this));
        
        triggers.on('dataset table:build', this.buildTable.bind(this));
        triggers.on('new dataset:build', this.buildNewDatasetOption.bind(this));
    },
    getData: function() {
        var datasets = 3;
            
        this.connection.php('collection/getEvent', {}, function(d) {
            try {
                this.events_arr = JSON.parse(d);
            } catch(err) {
                console.error(d);
                return;
            }
            
            datasets--;
            if(datasets == 0)
                this.configureData();
        }.bind(this));

        this.connection.php('collection/getRumor', {}, function(d) {
            try {
                this.rumors_arr = JSON.parse(d);
            } catch(err) {
                console.error(d);
                return;
            }
            
            datasets--;
            if(datasets == 0)
                this.configureData();
        }.bind(this));
        
        this.connection.php('collection/getSubset', {}, function(d) {
            try {
                this.subsets_arr = JSON.parse(d);
            } catch(err) {
                console.error(d);
                return;
            }
            
            datasets--;
            if(datasets == 0)
                this.configureData();
        }.bind(this));
    },
    configureData: function() {
        // Clear any old data
        this.events = {};
        this.rumors = {};
        this.subsets = {};
        this.event_types = {};
        
        this.event_types_arr = [];
        this.features_arr = [];
        
        // Link all of the data
        this.events_arr.forEach(this.configureRawEventObject, this);
        this.rumors_arr.forEach(this.configureRawRumorObject, this);
        this.subsets_arr.forEach(this.configureRawSubsetObject, this);
        
        // Add children columns
        this.event_types_arr.sort(function(a, b) {
            if (a.Label < b.Label) return -1;
            if (a.Label > b.Label) return 1;
            return 0;
        });
        this.event_types_arr.forEach(function(d, i) {
            d.ID = i;
            d.children = d.events_arr;
        });
        
        this.events_arr.forEach(function(event) {
            event.children = event.rumors_arr;
            
            event.rumors_arr.sort(function(a, b) {
                if (a.ID < b.ID) return -1;
                if (a.ID > b.ID) return 1;
                return 0;
            });
        });
        
        this.rumors_arr.forEach(function(rumor) {
            rumor.children = rumor.features_arr;
            
            rumor.features_arr.sort(function(a, b) {
                if (a.ID < b.ID) return -1;
                if (a.ID > b.ID) return 1;
                return 0;
            });
        });
        
        this.features_arr.forEach(function(feature, i) {
            feature.children = feature.subsets_arr;
            feature.ID = feature.Event.ID * 100 + i;
            
            feature.subsets_arr.sort(function(a, b) {
                if (a.ID < b.ID) return -1;
                if (a.ID > b.ID) return 1;
                return 0;
            });
        });
        
        this.buildOptions();
    },
    configureRawEventObject: function(event) {
        // Add fields
        event.ID = parseInt(event.ID);
        event.Label = event.DisplayName || event.Name;
        event.Level = 1;
        this.quantities.forEach(function (quantity) {
            event[quantity] = parseInt(event[quantity]) || 0;
        });
        event['FirstTweet'] = event['FirstTweet'] ? new BigNumber(event['FirstTweet']) : new BigNumber('0');
        event['LastTweet']  = event['LastTweet']  ? new BigNumber(event['LastTweet'])  : new BigNumber('0');
        
        // Add to event type list (or make new event type list)
        var type = event.Type;
        var event_type;
        if(type in this.event_types) {
            event_type = this.event_types[type];
            event_type.events_arr.push(event);
        } else {
            event_type = {
                Level: 0,
                Label: type,
                events_arr: [event]
            }
            event_type['Event Type'] = event_type;
            this.event_types[type] = event_type;
            this.event_types_arr.push(event_type);
        }

        // Add children
        var event_rumor = {
            Event: event.ID,
            ID: 0,
            Name: 'All Tweets in Event',
            Definition: '',
            Query: '',
            StartTime: event.StartTime,
            StopTime:  event.StopTime,
            Active: '1'
        }
        event.rumors = {0: event_rumor};
        event.rumors_arr = [event_rumor];
        this.rumors_arr.push(event_rumor);
        event.subsets_arr = [];

        this.quantities.forEach(function (quantity) {
            event_rumor[quantity] = event[quantity];
        });
        event_rumor['FirstTweet'] = event['FirstTweet'];
        event_rumor['LastTweet']  = event['LastTweet'];

        // Add ancestors
        event['Event']      = event; // weird but makes things easier
        event['Event Type'] = event_type;

        // Add to indiced object
        this.events[event.ID] = event;
    },
    configureRawRumorObject: function(rumor) {
        rumor.ID = parseInt(rumor.ID);
        rumor.Level = 2;
        rumor.Label = rumor.Name;
        rumor.features =  {};
        rumor.features_arr = [];
        rumor.subsets_arr = [];

        // Add rumor to Event
        rumor.Event_ID = rumor.Event;
        var event = this.events[rumor.Event_ID];
        if(!(rumor.ID in event.rumors)) {
            event.rumors[rumor.ID] = rumor;
            event.rumors_arr.push(rumor);
        }

        // Add ancestors
        rumor['Rumor']      = rumor;
        rumor['Event']      = event;
        rumor['Event Type'] = event['Event Type'];

        // Add to indiced object
        this.rumors[event.ID + '_' + rumor.ID] = rumor;
    },
    configureRawSubsetObject: function(subset) {
        // Add fields
        subset.ID = parseInt(subset.ID);
        subset.Label = util.subsetName(subset);
        subset.FeatureMatch = util.subsetName({
            feature: subset.Feature,
            match: subset.Match,
            includeFeature: true
        });
//            subset.Label = subset.Match.replace(/\\W/g, '<span style="color:#ccc">_</span>');
        subset.Level = 4;
        this.quantities.forEach(function (quantity) {
            subset[quantity] = parseInt(subset[quantity]) || 0;
        });
        subset['FirstTweet'] = subset['FirstTweet'] ? new BigNumber(subset['FirstTweet']) : new BigNumber('0');
        subset['LastTweet']  = subset['LastTweet']  ? new BigNumber(subset['LastTweet'])  : new BigNumber('0');

        // Get ancestors
        subset.Event_ID = subset.Event;
        var event = this.events[subset.Event_ID];
        var rumor = event.rumors[subset.Rumor];

        // If it is actually a rumor subset, add data to the rumor
        if(subset.Feature == 'Rumor') {
            if(this.Match in this.rumors) {
                subset.Label = this.rumors[this.Match].Label;
                subset.FeatureMatch = 'Rumor: ' + subset.Label
            }

            var actual_rumor = event.rumors[subset.Match];
            this.quantities.forEach(function (quantity) {
                actual_rumor[quantity] = parseInt(subset[quantity]) || 0;
            });
            actual_rumor['FirstTweet'] = subset['FirstTweet'] ? new BigNumber(subset['FirstTweet']) : new BigNumber('0');
            actual_rumor['LastTweet']  = subset['LastTweet']  ? new BigNumber(subset['LastTweet'])  : new BigNumber('0');
        } else if(subset.Feature == 'Event') {
            if(this.Match in this.events) {
                subset.Label = this.events[this.Match].Label;
            }
        }

        // Add to feature in rumor
        var feature;
        if(subset.Feature in rumor.features) {
            feature = rumor.features[subset.Feature];
            feature.subsets[subset.Match] = subset;
            feature.subsets_arr.push(subset);
        } else {
            feature = {
                Level: 3,
                Label: subset.Feature,
                Rumor: rumor,
                Event: event,
                'Event Type': event['Event Type'],
                subsets: {},
                subsets_arr: [subset]
            }
            feature['Feature'] = feature;
            feature.subsets[subset.Match] = subset;
            rumor.features[subset.Feature] = feature;
            rumor.features_arr.push(feature);
            this.features_arr.push(feature);
        }
        
        // Add to subset list in event
        rumor.subsets_arr.push(subset);
        event.subsets_arr.push(subset);

        // Add to ancestors
        subset['Subset']     = subset;
        subset['Feature']    = feature;
        subset['Rumor']      = rumor;
        subset['Event']      = event;
        subset['Event Type'] = event['Event Type'];

        // Add to indiced object
        this.subsets[subset.ID] = subset;
    },
    computeAggregates: function() {
        this.features_arr.forEach(function(d) {
            var children = d.children;
            if(d.Label == 'Code') {
                children = [d.subsets['Uncodable'], d.subsets['Codable']];
            }
            
            ['Tweets', 'DistinctTweets', 
              'Originals', 'DistinctOriginals', 'Retweets', 'DistinctRetweets', 
              'Replies', 'DistinctReplies', 'Quotes', 'DistinctQuotes', 'Minutes'].forEach(function(count) {
                d[count] = d3.sum(children, function(e) { return e[count] || 0; });
            });
            
            d.FirstTweet_Min    = d3.min(children, function(e) { return e.FirstTweet        || new BigNumber(1e20); });
            d.FirstTweet_Max    = d3.max(children, function(e) { return e.FirstTweet        || new BigNumber(0); });
            d.LastTweet_Min     = d3.min(children, function(e) { return e.LastTweet         || new BigNumber(1e20); });
            d.LastTweet_Max     = d3.max(children, function(e) { return e.LastTweet         || new BigNumber(0); });
            
            d.FirstTweet        = d.FirstTweet_Min;
            d.LastTweet         = d.LastTweet_Max;
            d.ID_Min            = d3.min(children, function(e) { return parseInt(e.ID)      || new BigNumber(0); });
            d.ID_Max            = d3.max(children, function(e) { return parseInt(e.ID)      || new BigNumber(0); });
        });
        
        this.event_types_arr.forEach(function(d) {
            ['Tweets', 'DistinctTweets', 
              'Originals', 'DistinctOriginals', 'Retweets', 'DistinctRetweets', 
              'Replies', 'DistinctReplies', 'Quotes', 'DistinctQuotes', 'Minutes'].forEach(function(count) {
                d[count] = d3.sum(d.children, function(e) { return e[count] || 0; });
            });
            
            d.FirstTweet_Min    = d3.min(d.children, function(e) { return e.FirstTweet        || new BigNumber(1e20); });
            d.FirstTweet_Max    = d3.max(d.children, function(e) { return e.FirstTweet        || new BigNumber(0); });
            d.LastTweet_Min     = d3.min(d.children, function(e) { return e.LastTweet         || new BigNumber(1e20); });
            d.LastTweet_Max     = d3.max(d.children, function(e) { return e.LastTweet         || new BigNumber(0); });
            
            d.FirstTweet        = d.FirstTweet_Min;
            d.LastTweet         = d.LastTweet_Max;
            d.ID_Min            = d3.min(d.children, function(e) { return parseInt(e.ID)      || new BigNumber(0); });
            d.ID_Max            = d3.max(d.children, function(e) { return parseInt(e.ID)      || new BigNumber(0); });
        });
        
        triggers.emit('update_counts');
    },
    buildOptions: function() {
        this.ops.updateCollectionCallback = this.getData;
        
        var orders = ['ID', 'Collection', 'Tweets', 
                      'Originals', 'Retweets', 'Replies', 'Quotes', 
                      'First Tweet', 'Last Tweet', 'Minutes'];
        this.ops['Columns'] = {
            Distinct: new Option({
                title: 'Distinct?',
                labels: ['Show All', 'Only Distinct'],
                ids:    ['', 'Distinct'],
                default: 0,
                type: "dropdown",
                callback: triggers.emitter('update_counts')
            }),
            Relative: new Option({
                title: 'Relative to',
                labels: ['-', 'Event', 'Event\'s Tweet Types', 'Match', 'Distinct/Not'],
                ids:    ['raw', 'event', 'type', 'match', 'distinct'],
                default: 0,
                type: "dropdown",
                callback: triggers.emitter('update_counts')
            }),
            'Date Format': new Option({
                title: 'First/Last Tweet',
                labels: ['Tweet ID', 'Date'],
                ids:    ['id', 'date'],
                default: 1,
                type: "dropdown",
                callback: triggers.emitter('update_counts')
            }),
            'Minutes Format': new Option({
                title: 'Minutes',
                labels: ['Count', 'Day/Hour/Min'],
                ids:    ['count', 'minutes'],
                default: 0,
                type: "dropdown",
                callback: triggers.emitter('update_counts')
            })
        };
        this.ops['Rows'] = {
            Hierarchical: new Option({
                title: 'Maintain Hierarchy',
                labels: ['Yes', 'No'],
                ids:    ["true", "false"],
                default: 0,
                type: "dropdown",
                callback: triggers.emitter('sort_elements')
            }),
            Order: new Option({
                title: 'Order',
                labels: orders,
                ids:    orders,
                default: 1,
                type: "dropdown",
                callback: triggers.emitter('sort_elements')
            }),
            Ascending: new Option({
                title: 'Ascending',
                labels: ['Ascending', 'Descending'],
                ids:    ['true', 'false'],
                default: 0,
                type: "dropdown",
                callback: triggers.emitter('sort_elements')
            }),
            Empties: new Option({
                title: 'Empty Rows',
                labels: ['Show', 'Hide'],
                ids:    ['table-row', 'none'],
                default: 1,
                type: "dropdown",
                callback: triggers.emitter('refresh_visibility')
            }),
            'Level 0 Showing Children': new Option({
                title: 'Event Types Showing Events',
                labels: ['List'],
                ids:    [[]],
                render: false,
                custom_entries_allowed: true,
                callback: triggers.emitter('refresh_visibility')
            }),
            'Level 1 Showing Children': new Option({
                title: 'Events Showing Features',
                labels: ['List'],
                ids:    [[]],
                render: false,
                custom_entries_allowed: true,
                callback: triggers.emitter('refresh_visibility')
            }),
            'Level 2 Showing Children': new Option({
                title: 'Rumors Showing Features',
                labels: ['List'],
                ids:    [[]],
                render: false,
                custom_entries_allowed: true,
                callback: triggers.emitter('refresh_visibility')
            }),
            'Level 3 Showing Children': new Option({
                title: 'Features Showing Matches',
                labels: ['List'],
                ids:    [[]],
                render: false,
                custom_entries_allowed: true,
                callback: triggers.emitter('refresh_visibility')
            })
        }
        this.ops.panels = ['Rows', 'Columns'];
        
        // Start drawing options
        this.ops.init();
        
        // Also make the modal
        triggers.emit('modal:build');
        triggers.emit('dataset table:build');
        triggers.emit('new dataset:build');
    },
    buildTable: function() {
        var columns = ['ID', 'Collection',
                       'Tweets', 'Originals', 'Retweets', 'Replies', 'Quotes', 
                       'First Tweet', 'Last Tweet', 'Minutes', 
                       'Open'];// <span class="glyphicon glyphicon-new-window"></span>
        
        d3.select('#table-container').selectAll('*').remove();
        var table = d3.select('#table-container')
            .append('table')
            .attr('id', 'status_table')
            .attr('class', 'table table-sm')
        
        table.append('thead')
            .append('tr')
            .selectAll('th')
            .data(columns)
            .enter()
            .append('th')
            .append('div')
            .attr('class', function(d) {
                if(d == 'Open') return null;
                return 'col-sortable col-' + util.simplify(d); 
            })
            .html(function(d) { return d.replace('Distinct ', ''); });
        
        table.selectAll('.col-sortable')
            .on('click', this.clickSort.bind(this))
            .append('span')
            .attr('class', 'glyphicon glyphicon-sort glyphicon-hiddenclick');
        
        var table_body = table.append('tbody');
        
        // Add table rows
        this.event_types_arr.forEach(function(event_type) {
            event_type.row = table_body.append('tr')
                .data([event_type])
                .attr('class', 'row_type row_haschildren');
            
            event_type.events_arr.forEach(function(event) {
                event.row = table_body.append('tr')
                    .data([event])
                    .attr('class', function(d) { return 'row_event row_haschildren row_event_' + d.ID; });
                
                event.rumors_arr.forEach(function(rumor) {
                    rumor.row = table_body.append('tr')
                        .data([rumor])
                        .attr('class', function(d) { return 'row_rumor row_haschildren row_rumor_' + d.ID; });
                    
                    rumor.features_arr.forEach(function(feature) {
                        feature.row = table_body.append('tr')
                            .data([feature])
                            .attr('class', function(d) { return 'row_feature row_haschildren'; });

                        feature.subsets_arr.forEach(function(subset) {
                            subset.row = table_body.append('tr')
                                .data([subset])
                                .attr('class', function(d) { return 'row_subset row_subset_' + d.ID; });
                        });
                    });
                });
            });
        })
        
        // ID & Label
        table_body.selectAll('tr')
            .append('td')
            .html(function(d) { return [1, 2, 4].includes(d.Level) ? d.ID : ''; })
        
        table_body.selectAll('tr')
            .append('td')
            .append('div')
            .attr('class', 'cell-label')
            .append('span')
            .attr('class', 'value')
            .html(function(d) { return d.Label; });
        
        var level_names = ['events', 'rumors', 'features', 'matches', 'N/A'];
        table_body.selectAll('.row_haschildren .cell-label')
            .on('click', this.setVisibility_children.bind(this))
            .append('small')
            .attr('class', 'glyphicon-hiddenclick')
            .html(function(d) { 
                return d.children.length + (d.Level == 1 ? -1 : 0) + ' ' + level_names[d.Level]; 
            });
        
        table_body.selectAll('.row_haschildren .cell-label')
            .append('span')
            .attr('class', 'glyphicon glyphicon-chervon-left glyphicon-hiddenclick')
            .style('margin-left', '0px');
        
        this.tooltip.attach('.cell-label', function(set) {
            if(set['Level'] == 0) {
                return {
                    ID:           set['ID'],
                    'Event Type': set['Label'],
                    Events:       set['events_arr'] ? set['events_arr'].map(function(event) { return event['Label']; }) : null
                }
            } else if(set['Level'] == 1) {
                return {
                    ID:           set['ID'],
                    Event:        set['Label'],
                    'Event Type': set['Event Type']['Label'],
                    Rumors:       set['rumors_arr'] ? set['rumors_arr'].map(function(event) { return event['Label']; }) : null
                }
            } else if(set['Level'] == 2) {
                return {
                    ID:           set['ID'],
                    Rumor:        set['Label'],
                    Event:        set['Event']['Label'],
                    'Event Type': set['Event Type']['Label'],
                    Features:     set['features_arr'] ? set['features_arr'].map(function(event) { return event['Label']; }) : null
                }
            } else if(set['Level'] == 3) {
                return {
                    ID:           set['ID'],
                    Feature:      set['Label'],
                    Rumor:        set['Rumor']['Label'],
                    Event:        set['Event']['Label'],
                    'Event Type': set['Event Type']['Label']
                }
            } else {
                return {
                    ID:           set['ID'],
                    Match:        set['Match'],
                    Feature:      set['Feature']['Label'],
                    Rumor:        set['Rumor']['Label'],
                    Event:        set['Event']['Label'],
                    'Event Type': set['Event Type']['Label']
                }
            }
        });
        
        
        // Counts
        ['Tweets', 'Originals', 'Retweets', 'Replies', 'Quotes'].forEach(function(type) {
            table_body.selectAll('tr')
                .append('td')
            .append('div')
                .attr('class', 'cell-' + type + ' cell-count')
                .append('span').attr('class', 'value');
            
            // Tooltip with summary starts
            this.tooltip.attach('.cell-' + type, function(set) {
                var value = set[type];
                var info = {};
                if(value == undefined)
                    return info;

                var event = set['Event'] || set;
//                var feature = set['Feature'] || set;
                info[type] = util.formatThousands(value);
                if(set.Level >= 2 || type != 'Tweets') {
                    info['% of Event'] = (value / event['Tweets'] * 100).toFixed(1) + '%';
                }
                if(set.Level >= 2 && type != 'Tweets') {
                    info['% of Type'] = (value / event[type] * 100).toFixed(1) + '%';
//                    info['% of Feature'] = (value / feature['Tweets'] * 100).toFixed(1) + '%';
                    if(set.Level >= 4) {
                        info['% of Subset'] = (value / set['Tweets'] * 100).toFixed(1) + '%';
                    }
                }
                
                var distinct = set['Distinct' + type];
                info['Distinct ' + type] = util.formatThousands(distinct);
                info['% Distinct'] = (distinct / value * 100).toFixed(1) + '%';
                if(set.Level >= 2 || type != 'Tweets') {
                    info['% D of Event'] = (distinct / event['Tweets'] * 100).toFixed(1) + '%';
                }
                if(set.Level >= 2 && type != 'Tweets') {
                    info['% D of Type '] = (distinct / event['Distinct' + type] * 100).toFixed(1) + '%';
//                    info['% D of Feature'] = (value / feature['Tweets'] * 100).toFixed(1) + '%';
                    if(set.Level >= 4) {
                        info['% D of Subset'] = (value / set['Tweets'] * 100).toFixed(1) + '%';
                    }
                }

                return info;
            });
        }, this);
        
        // Append the recalculate button
//        table_body.selectAll('.row_type .cell-Tweets, .row_feature .cell-Tweets').append('span') // hidden one to help alignment
//            .attr('class', 'glyphicon glyphicon-refresh glyphicon-hidden');
        table_body.selectAll('.row_type .cell-Tweets, .row_rumor .cell-Tweets, .row_feature .cell-Tweets').append('span') // hidden one to help alignment
            .attr('class', 'glyphicon glyphicon-refresh glyphicon-hidden'); // TODO allow rumors to recalculate
        table_body.selectAll('.row_event .cell-Tweets, .row_subset .cell-Tweets').append('span')
            .attr('class', 'glyphicon glyphicon-refresh glyphicon-hiddenclick')
            .on('click', this.recount.bind(this));
        
        // Times (use glyphicon-time or glyphicon-refresh)
        table_body.selectAll('tr')
            .append('td')
            .attr('class', 'cell-firstdate');
        table_body.selectAll('tr')
            .append('td')
            .attr('class', 'cell-lastdate');
        this.tooltip.attach('.cell-firstdate, .cell-lastdate', function(set) {
            return {
                'First Tweet': set['FirstTweet'],
                'Last Tweet':  set['LastTweet'],
                'Start Time':  util.formatDate(util.twitterID2Timestamp(set['FirstTweet'])),
                'End Time':    util.formatDate(util.twitterID2Timestamp(set['LastTweet'])),
            };
        });
        
        var minute_cells = table_body.selectAll('tr')
            .append('td')
            .append('div')
            .attr('class', 'cell-minutes cell-count');
        minute_cells.append('span').attr('class', 'value');
        
//        table_body.selectAll('.row_type .cell-minutes, .row_feature .cell-minutes').append('span') // hidden one to help alignment
//            .attr('class', 'glyphicon glyphicon-refresh glyphicon-hidden');
        table_body.selectAll('.row_type .cell-minutes, .row_rumor .cell-minutes, .row_feature .cell-minutes').append('span') // hidden one to help alignment
            .attr('class', 'glyphicon glyphicon-refresh glyphicon-hidden'); // TODO allow rumors to recalculate
        table_body.selectAll('.row_event .cell-minutes, .row_subset .cell-minutes').append('span')
            .attr('class', 'glyphicon glyphicon-refresh glyphicon-hiddenclick')
            .on('click', this.computeTimeseries.bind(this));
        
        // Buttons
        table_body.selectAll('tr')
            .append('td')
            .attr('class', 'cell_options')
        
        table_body.selectAll('.row_event .cell_options, .row_subset .cell_options')
            .append('span')
            .attr('class', 'glyphicon glyphicon-edit glyphicon-hoverclick')
            .on('click', this.edit.bind(this));

//        table_body.selectAll('.row_event .cell_options')
//            .append('span')
//            .attr('class', 'glyphicon glyphicon-signal glyphicon-hoverclick')
//            .style('margin-left', '5px')
//            .on('click', this.openTimeseries);
        
//        table_body.selectAll('.row_rumor .cell_options')
//            .append('span')
////            .attr('class', 'btn btn-xs btn-default')
//            .text('Codes')
//            .attr('class', 'glyphicon-hoverclick')
//            .style('margin-left', '5px')
//            .on('click', this.openCodingReport);
        
        // Set initial visibility
        this.event_types_arr.forEach(function(d) { 
            this.setVisibility_children(d, 'perserve'); 
        }.bind(this), this);
        
        // Set the counts
        triggers.emit('new_counts');
    },
    setVisibility_children: function(d, show_children) {
        var list_op = this.ops['Rows']['Level ' + d.Level + ' Showing Children'];
        var list = list_op.get();
        
        // Toggle showing children or not
        if(show_children == undefined || typeof(show_children) == 'number') { // Not hard-coded, so just toggle
            show_children = !list.includes(d.ID);
        } else if (show_children == 'perserve') { // Only occurs during first initialization
            show_children = list.includes(d.ID) ? 'perserve' : false;
        }

        // Set the option
        if(show_children) {
            if(!list.includes(d.ID))
                list.push(d.ID);
        } else {
            list = list.filter(function(set) {
                return set != d.ID;
            });
        }
        list_op.set(list);
        this.ops.recordState(false);

        // Set the chevron to point the right direction
        d.row.select('.cell-label .glyphicon')
            .classed('glyphicon-chevron-down', show_children)
            .classed('glyphicon-chevron-left', !show_children);
        
        // Add/remove not shown class to subsets as appropriate
        var show_empties = this.ops['Rows']['Empties'].is('table-row');
        d.children.forEach(function(child) {
            var show_child = show_children && (show_empties || !child.row.classed('row-zero'));
            child.row.classed('not_shown', !show_children)
                .style('display', show_child ? 'table-row' : 'none');
            if('children' in child)
                this.setVisibility_children(child, show_children ? 'perserve' : false);
        }, this)
    },
    setVisibility: function() {
        var table_body = d3.select('tbody');
        
        table_body.selectAll('tr')
            .style('display', 'table-row');
        if(this.ops['Rows']['Empties'].is('none')) {
            table_body.selectAll('tr.row-zero')
                .style('display', 'none');
        }
        table_body.selectAll('tr.not_shown')
            .style('display', 'none');
        
        triggers.emit('sort_elements');
    },
    updateTableCounts: function(selector) {
        selector = selector || 'tbody';
        var table_body     = d3.select(selector);
        var distinct       = this.ops['Columns']['Distinct'].get();
        var relative       = this.ops['Columns']['Relative'].get();
        var date_format    = this.ops['Columns']['Date Format'].get();
        var minutes_format = this.ops['Columns']['Minutes Format'].get();
        
        // Update the text of rows with the counts
        
        ['Tweets', 'Originals', 'Retweets', 'Replies', 'Quotes'].forEach(function(type) {
            var quantity = distinct + type;
            table_body.selectAll('.cell-' + type + ' .value')
                .html(function(d) {
                    var value = d[quantity];
                    if(!value)
                        return '';
                    if(relative == 'raw') {
                        d[type + 'Display'] = value;
                        return util.formatThousands(value);
                    }
                    var denom = relative == 'event'    ? (d['Level'] >= 2 ? d['Event']['Tweets'] : d['Tweets']) : 
                                relative == 'type'     ? (d['Level'] >= 2 ? d['Event'][quantity] : d[quantity]) : 
//                                relative == 'feature'  ? (d['Level'] >= 3 ? d['Feature Set'][quantity] : d[quantity]): 
                                relative == 'subset'   ? d['Tweets'] : 
                                relative == 'distinct' ? d[type] : 1;
                    d[type + 'Display'] = value / denom;
                    return (value / denom * 100).toFixed(1);
                });
        });
        
        // Set visibility of zero/non-zero rows
        table_body.selectAll('tr')
            .classed('row-zero', function(d) { return !(d.Tweets || d.Minutes || d.CodedTweets) ; });
        
        // Dates
        table_body.selectAll('.cell-firstdate')
            .html(function(d) {
                if(!('FirstTweet') in d || d['FirstTweet'] == 0 || d['FirstTweet'] == 1e20) return '';
                if(date_format == 'date') {
                    var date = d.FirstTweet;
                    date = util.twitterID2Timestamp(date);
                    return util.formatDate(date);
                }
                return d.FirstTweet;
            });
        table_body.selectAll('.cell-lastdate')
            .html(function(d) { 
                if(!('LastTweet') in d || d['LastTweet'] == 0 || d['LastTweet'] == 1e20) return '';
                if(date_format == 'date') {
                    var date = d.LastTweet;
                    date = util.twitterID2Timestamp(date);
                    return util.formatDate(date);
                }
                return d.LastTweet;
//                return 'LastTweet' in d && d.LastTweet ? d.LastTweet || '-' : ''; 
            });
        
        // Minutes
        table_body.selectAll(".cell-minutes .value")
            .transition()
            .duration(1000)
            .tween("text", function (d) {
                var start = this.textContent;
                if(typeof(start) == 'string') {
                    if(start.includes('m')) {
                        start = util.deformatMinutes(start);
                    } else {
                        start = parseInt(start.replace(/ /g, ''));
                    }
                }
                var interpol = d3.interpolate(start || 0, d.Minutes || 0);

                return function (value) {
                    if(typeof(value) == 'string') {
                        if(value.includes('m')) {
                            value = util.deformatMinutes(value);
                        } else {
                            value = parseInt(value.replace(/ /g, ''));
                        }
                    }
                    value = Math.round(interpol(value));
                    if(minutes_format == 'minutes') {
                        this.textContent = util.formatMinutes(value);
                    } else {
                        this.textContent = util.formatThousands(value);
                    }
                };
            });
        
        triggers.emit('refresh_visibility');
    },
    edit: function(d) {
        console.log(d);
        if(d.Level == 1) { // Event
            this.dataset.event = d;
            triggers.emit('edit collection:open', 'event');
        } else if(d.Level == 4) { // Subset
            this.dataset.subset = d;
            triggers.emit('edit collection:open', 'subset');
        }
    },
    clickSort: function(order, option) {
        var table_body = d3.select('tbody');
        if(!order) order = this.ops['Rows']['Order'].get();
        var header = d3.select('.col-' + util.simplify(order));
        var clicked = header.data()[0];
        var order = this.ops['Rows']['Order'].get();
        var ascending = this.ops['Rows']['Ascending'].get();
        
        if(clicked) {
            d3.selectAll('.col-sortable span')
                .attr('class', 'glyphicon glyphicon-sort glyphicon-hiddenclick');
        }
        
        // If it is clicked on what it is currently doing, flip it
        if(clicked == order && option != 'maintain_direction') {
            ascending = ascending == "true" ? "false" : "true";
            this.ops['Rows']['Ascending'].updateInInterface_id(ascending);
        } else if (clicked) { // Otherwise it's a new order
            order = clicked;
            this.ops['Rows']['Order'].updateInInterface_id(order);
            if(option != 'maintain_direction') {
                ascending = order == 'Collection' ? 'true' : 'false';
                this.ops['Rows']['Ascending'].updateInInterface_id(ascending);   
            }
        }
        
        // Sort the columns
        if(this.ops['Rows']['Hierarchical'].is('true')) {
            var quantity = order.replace(' ', '');
            if(quantity == 'Collection') quantity = 'Label';
            if(['Tweets', 'Originals', 'Retweets', 'Replies', 'Quotes'].includes(quantity)) {
                quantity = quantity + 'Display';
            }
//            var ascending_minmax = ascending == 'true' ? 'Min' : 'Max';
            var ascending_bin = ascending == 'true' ? 1 : -1;
            
            table_body.selectAll('tr').sort(function(a, b) {
                var lA = a['Level'];
                var lB = b['Level'];
                
                // Compare up hierarchy
                for(var level = 0; level < 5; level++) {
                    var type = this.hierarchy[level];
                    var A = a[type][quantity];
                    var B = b[type][quantity];
                    if(!A) return  1;
                    if(!B) return -1;
                    if(A < B) return -1 * ascending_bin;
                    if(A > B) return  1 * ascending_bin;
                    if(lA == level && lB == level) return  a['ID'] - b['ID'];
                    if(lA == level && lB >  level) return -1;
                    if(lA >  level && lB == level) return  1;
                }

                return 0;
            }.bind(this));
        } else {
//            var ascending_minmax = ascending == 'true' ? 'Max' : 'Min';
            var ascending_bin = ascending == 'true' ? 1 : -1;
            if(order == 'ID') {
                table_body.selectAll('tr').sort(function(a, b) {
                    var A = parseInt(a.ID); var B = parseInt(b.ID);
                    if(a.Level == 0) {
                        A = A || a['ID']; //_' + ascending_minmax];
                    }
                    if(b.Level == 0) {
                        B = B || b['ID']; //_' + ascending_minmax];
                    }

                    var cmp = A - B;
                    return ascending_bin * cmp || a.Level - b.Level;
                });
            } else if(order == 'Collection') {
                table_body.selectAll('tr').sort(function(a, b) {
                    var A = a.Label;
                    var B = b.Label;

                    return ascending_bin * d3.ascending(B, A);
                });
            } else {
                var quantity = order.replace(' ', '');
                if(['Tweets', 'Originals', 'Retweets', 'Replies', 'Quotes'].includes(quantity)) {
                    quantity = quantity + 'Display';
                }
                table_body.selectAll('tr').sort(function(a, b) {
                    var A = parseFloat(a[quantity]);
                    var B = parseFloat(b[quantity]);

                    if(a.Level == 0) {
                        A = A || parseFloat(a[quantity]); // + '_' + ascending_minmax]);
                    }
                    if(b.Level == 0) {
                        B = B || parseFloat(b[quantity]); // + '_' + ascending_minmax]);
                    }

                    if(!A && !B) return 0;
                    if(!A) return 1;
                    if(!B) return -1;

                    var cmp = d3.ascending(A, B);
                    return ascending_bin * cmp || a.Level - b.Level;
                });
            }
        }
        
        // Set the header's glyphicon class to reflect the order
        if(clicked) {
            if(ascending == 'true' && order == 'Collection') {
                header.select('span').attr('class', 'glyphicon glyphicon-sort-by-alphabet glyphicon-hoverclick');
            } else if(ascending == 'false' && order == 'Collection') {
                header.select('span').attr('class', 'glyphicon glyphicon-sort-by-alphabet-alt glyphicon-hoverclick');
            } else if(ascending == 'true') {
                header.select('span').attr('class', 'glyphicon glyphicon-sort-by-attributes glyphicon-hoverclick');
            } else if(ascending == 'false') {
                header.select('span').attr('class', 'glyphicon glyphicon-sort-by-attributes-alt glyphicon-hoverclick');
            }
        }
    },
    recount: function(d) {
        // Prepare statement
        var post = {
            Collection: d.Level == 1 ? 'event' : 'subset',
            ID: d.ID,
        }
        var row = '.row_' + (d.Level == 1 ? 'event' : 'subset') + '_' + d.ID;
        
        // Start loading sign
        var prog_bar = new Progress({
            'initial': 100,
            'parent_id': row + ' .cell-Tweets',
            style: 'full', 
            text: ' '
        });
        prog_bar.start();
        
        // Start the recount
        this.connection.phpjson('collection/recount', post, function(result) {     
            result = result[0];
            
            this.quantities.forEach(function (quantity) {
                d[quantity] = parseInt(result[quantity]) || 0;
            });
            d['FirstTweet'] = result['FirstTweet'] ? new BigNumber(result['FirstTweet']) : new BigNumber('0');
            d['LastTweet']  = result['LastTweet']  ? new BigNumber(result['LastTweet'])  : new BigNumber('0');
            
            triggers.emit('update_counts', row);

            // Remove loading sign
            prog_bar.end();
        }.bind(this),
        function(badresult) {
            console.log(badresult);
            prog_bar.update(100, 'Error');
        });
    },
    computeTimeseries: function(d) {
        var row = '.row_' + (d.Level == 1 ? 'event' : 'subset') + '_' + d.ID;
        var args = {
            url: 'timeseries/compute',
            post: {
                Collection: d.Level == 1 ? 'Event' : 'Subset',
                ID: d.ID,
                json: true,
            },
            quantity: 'tweet',
            min: d.FirstTweet,
            max: d.LastTweet,
            progress_div: row + ' .cell-minutes',
            progress_text: ' ',
            progress_style: 'full',
            on_chunk_finish: function(result) {
                d['Minutes'] = parseInt(result[0]['Minutes']);
                
                triggers.emit('update_counts', row);
            }
        }
        
        var conn = new Connection(args);
        conn.startStream();
    },
    openTimeseries: function(d) {
        var state = JSON.stringify({event: d.ID});
        window.open('timeseries.html#' + state);
    },
    openCodingReport: function(d) {
        var state = JSON.stringify({subset: d.ID});
        window.open('coding.html#' + state);
    },
    setInfo: function(set) {
        var distinct = this.ops['Columns']['Distinct'].get();
        console.log(this);
        var type = 'Tweets';
        var value = set[distinct + type];
        var info = {};
        if(value == undefined)
            return info;
        
        var event = set['Event'] || set;
        info[(distinct ? distinct  + ' ' : '') + type] = util.formatThousands(value);
        info['% of Event'             ] = (value / event['Tweets'] * 100).toFixed(1) + '%';
        info['% of Type in Event'     ] = (value / event[distinct + type] * 100).toFixed(1) + '%';
        info['% of Subset'            ] = (value / set['Tweets'] * 100).toFixed(1) + '%';
        info['% of Distinct + Repeats'] = (value / set[type] * 100).toFixed(1) + '%';

        console.log(info);
        return info;
    },
    buildNewDatasetOption: function() {
        var div = d3.select('#body').append('div');
        
        div.append('button')
            .attr('class', 'btn btn-default new-collection-button')
            .text('New Event')
            .on('click', triggers.emitter('edit collection:new', 'event'));
        
        div.append('button')
            .attr('class', 'btn btn-default new-collection-button')
            .text('New Subset')
            .on('click', triggers.emitter('edit collection:new', 'subset'));
        
        div.append('button')
            .attr('class', 'btn btn-default new-collection-button')
            .text('Add Tweets to Event')
            .on('click', triggers.emitter('alert', 'Sorry this button doesn\'t work yet'));
        
        div.append('button')
            .attr('class', 'btn btn-default new-collection-button')
            .text('Add Tweets to Subset')
            .on('click', triggers.emitter('alert', 'Sorry this button doesn\'t work yet'));
        
        div.append('button')
            .attr('id', 'tweet-transfer')
            .attr('class', 'btn btn-default new-collection-button')
            .text('Transfer Tweets')
            .on('click', this.transferTweets.bind(this));
    },
    transferTweets: function () {
        
        var connection = new Connection({
            url: 'tweets/transferTweets',
            post: {},
            min : 0, 
            max: 1000,
            quantity: 'count',
            progress_text: '{cur} / {max}',
            on_chunk_finish: function(d) { console.log(d); }
        });
        
        connection.startStream();
    }
};

function initialize() {
    SR = new StatusReport();
    
    SR.init();
}
window.onload = initialize;