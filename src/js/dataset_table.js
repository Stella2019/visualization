function DatasetTable() {
    this.connection = new Connection();
    this.ops = new Options(this);
    this.dataset = new CollectionManager(this, {name: 'dataset', flag_sidebar: false});
    this.tooltip = new Tooltip();
    this.contextmenu = new ContextMenu();
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
                       'Minutes', 'Users', 'Users2orMoreTweets', 'Users10orMoreTweets'];
    this.column_headers = [
        {Label: 'ID', ID: 'ID', Group: '', sortable: true, always_display: true},
        {Label: 'Collection', ID: 'Collection', Group: '', sortable: true, always_display: true},
        {Label: 'Tweets', ID: 'Tweets', Group: 'Tweets', count: true, sortable: true, always_display: true},
        {Label: 'Distinct', ID: 'DistinctTweets', Group: 'Tweets', count: true, sortable: true},
        {Label: 'Originals', ID: 'Originals', Group: 'Tweets', count: true, sortable: true},
        {Label: 'Retweets', ID: 'Retweets', Group: 'Tweets', count: true, sortable: true},
        {Label: 'Replies', ID: 'Replies', Group: 'Tweets', count: true, sortable: true},
        {Label: 'Quotes', ID: 'Quotes', Group: 'Tweets', count: true, sortable: true},
        {Label: 'First Tweet', ID: 'FirstTweet', Group: 'Time', sortable: true},
        {Label: 'Last Tweet', ID: 'LastTweet', Group: 'Time', sortable: true},
        {Label: 'Timeseries<br />Minutes', ID: 'Minutes', Group: 'Time', count: true, sortable: true, always_display: true},
        {Label: 'Users', ID: 'Users', Group: 'Users', count: true, sortable: true, always_display: true},
        {Label: 'w/ 2+ Tweets', ID: 'Users2orMoreTweets', Group: 'Users', count: true, sortable: true},
        {Label: 'w/ 10+ Tweets', ID: 'Users10orMoreTweets', Group: 'Users', count: true, sortable: true},
        {Label: 'Dataset', ID: 'DatasetActions', Group: 'Actions'},
        {Label: 'Tweets', ID: 'TweetsActions', Group: 'Actions'},
        {Label: 'Timeseries', ID: 'TimeseriesActions', Group: 'Actions'},
        {Label: 'Users', ID: 'UsersActions', Group: 'Actions'},
//        {Label: 'Open', Quantity: '', Group: 'Standard'}
    ];
    
    this.download = {
        stream: false,
        dataset: false,
        data: [],
        datatype: ''
    };
}
DatasetTable.prototype = {
    init: function() {
        this.setTriggers();
        this.getData();
        this.tooltip.init();
        this.contextmenu.init();
    },
    setTriggers: function() {
        triggers.on('sort_elements', function() { this.clickSort(false, 'maintain_direction'); }.bind(this));
        triggers.on('new_counts',         this.computeAggregates.bind(this));
        triggers.on('update_counts',      this.updateTableCounts.bind(this));
        triggers.on('refresh_visibility', this.setVisibility_Rows.bind(this));
        triggers.on('toggle columns', this.setVisibility_Columns.bind(this));
        
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
        this.event_types_arr.forEach(function(event_type, i) {
            event_type.CollectionType = 'EventType';
            event_type.ID = i;
            event_type.children = event_type.events_arr;
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
            rumor.children = rumor.features_arr.filter(f => f.Label != 'Rumor');
            
            rumor.features_arr.sort(function(a, b) {
                if (a.ID < b.ID) return -1;
                if (a.ID > b.ID) return 1;
                return 0;
            });
        });
        
        this.features_arr.forEach(function(feature, i) {
            feature.CollectionType = 'Feature';
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
        event.CollectionType = 'Event';
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
            ID: event.ID - 10000,
            Name: 'All Tweets in Event',
            Definition: '',
            Query: '',
            StartTime: event.StartTime,
            StopTime:  event.StopTime,
            Active: '1'
        }
        event.rumors = {};
        event.rumors[(event.ID - 10000)] = event_rumor;
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
        rumor.CollectionType = rumor.ID > 0 ? 'Rumor' : 'DefaultRumor';
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
        this.rumors[rumor.ID] = rumor;
    },
    configureRawSubsetObject: function(subset) {
        // Add fields
        subset.ID = parseInt(subset.ID);
        subset.Label = util.subsetName(subset);
        subset.CollectionType = 'Subset';
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
        var rumor_ID = subset.Rumor != "0" ? subset.Rumor : (parseInt(subset.Event_ID) - 10000);
        var rumor = event.rumors[rumor_ID];

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
            actual_rumor['Subset_ID']  = subset.ID;
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
            
            this.quantities.forEach(function(count) {
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
        }, this);
        
        this.event_types_arr.forEach(function(d) {
            this.quantities.forEach(function(count) {
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
        }, this);
        
        triggers.emit('update_counts');
    },
    buildOptions: function() {
        this.ops.updateCollectionCallback = this.getData;
        
        var columns_sortable = this.column_headers.filter(d => d.sortable);
        this.ops['Columns'] = {
            'Tweet Type Counts': new Option({
                title: 'Tweet Types',
                labels: ['Hidden', 'Shown'],
                ids:    ['hidden', 'shown'],
                default: 0,
                type: "toggle",
                tooltip: "Show or hide columns with the count of each specific type of tweet",
                callback: triggers.emitter('toggle columns')
            }),
            'Dates': new Option({
                title: 'Dates',
                labels: ['Hidden', 'Shown'],
                ids:    ['hidden', 'shown'],
                default: 0,
                type: "toggle",
                tooltip: "Show or hide columns the start & end dates of the datasets",
                callback: triggers.emitter('toggle columns')
            }),
            'Repeat Users': new Option({
                title: 'Repeat Users',
                labels: ['Hidden', 'Shown'],
                ids:    ['hidden', 'shown'],
                default: 0,
                type: "toggle",
                tooltip: "Show or hide columns listing how many users tweeted more than once, and 10 or more times",
                callback: triggers.emitter('toggle columns')
            }),
            'Actions': new Option({
                title: 'Actions',
                labels: ['Hidden', 'Shown'],
                ids:    ['hidden', 'shown'],
                default: 0,
                type: "toggle",
                tooltip: "Show or hide columns with buttons for actions on events & subsets",
                callback: triggers.emitter('toggle columns')
            }),
            'Show Deletion': new Option({
                title: 'Deletion',
                labels: ['Hidden', 'Shown'],
                ids:    ['hidden', 'shown'],
                default: 0,
                type: "toggle",
                tooltip: "In Action columns, display option to clear timeseries and user list. Default: off to prevent accidents.",
                callback: triggers.emitter('toggle columns')
            }),
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
            }),
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
                labels: columns_sortable.map(d => d.Label),
                ids:    columns_sortable.map(d => d.ID),
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
                title: 'Uncounted Rows',
                labels: ['Hidden', 'Shown'],
                ids:    ['none', 'table-row'],
                default: 0,
                type: "toggle",
                callback: triggers.emitter('refresh_visibility')
            }),
//            Unopened: new Option({
//                title: 'Unopened Rows',
//                labels: ['Hidden', 'Shown'],
//                ids:    ['none', 'table-row'],
//                default: 0,
//                type: "toggle",
//                callback: triggers.emitter('refresh_visibility')
//            }),
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
        d3.select('#table-container').selectAll('*').remove();
        var table = d3.select('#table-container')
            .append('table')
            .attr('id', 'status_table')
            .attr('class', 'table table-sm');
        
        table.append('thead')
            .append('tr')
            .selectAll('th')
            .data(this.column_headers)
            .enter()
            .append('th')
            .append('div')
            .attr('class', d => 'col-sortable col-' + d.ID)
            .html(d => d.Label);
        
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
                    .attr('class', d => 'row_event row_haschildren row_event_' + d.ID);
                
                event.rumors_arr.forEach(function(rumor) {
                    rumor.row = table_body.append('tr')
                        .data([rumor])
                        .attr('class', d => 'row_rumor row_haschildren row_rumor_' + d.ID + (d.CollectionType == 'Rumor' ? ' row_rumorwithsubset row_subset_' + d.Subset_ID : ''));
                    
                    rumor.features_arr.forEach(function(feature) {
                        if(feature.Label != 'Rumor') {
                            feature.row = table_body.append('tr')
                                .data([feature])
                                .attr('class', d => 'row_feature row_haschildren');

                            feature.subsets_arr.forEach(function(subset) {
                                subset.row = table_body.append('tr')
                                    .data([subset])
                                    .attr('class', d => 'row_subset row_subset_' + d.ID);
                            });
                        }
                    });
                });
            });
        })
        
//        // Add right click context menu to event & subset rows
//        this.contextmenu.attach('.row_event, .row_subset', this.prepareCollectionContextMenu.bind(this));
        
        // Add all of the cells
        this.column_headers.forEach(function(column) {
            table_body.selectAll('tr')
                .append('td')
                .append('div')
                .attr('class', 'cell-' + column.ID + (column.count ? ' cell-count' : ''));
        })
        
        // ID & Label
        table_body.selectAll('.cell-ID')
            .html(dataset => [1, 2, 4].includes(dataset.Level) && dataset.CollectionType != 'DefaultRumor' ? dataset.ID : '')
        
        table_body.selectAll('.cell-Collection')
            .append('span')
            .attr('class', 'value')
            .style('margin-left', dataset => dataset.Level * 10 + 'px')
            .html(dataset => dataset.Label);
        
        var level_names = ['events', 'rumors', 'features', 'matches', 'N/A'];
        table_body.selectAll('.row_haschildren .cell-Collection')
            .on('click', this.setVisibility_Rows_children.bind(this))
            .append('small')
            .attr('class', 'glyphicon-hiddenclick')
            .html(function(d) { 
                return d.children.length + (d.Level == 1 ? -1 : 0) + ' ' + level_names[d.Level]; 
            });
        
        table_body.selectAll('.row_haschildren .cell-Collection')
            .append('span')
            .attr('class', 'glyphicon glyphicon-chervon-left glyphicon-hiddenclick')
            .style('margin-left', '0px');
        
        // Add tool tips
        this.tooltip.attach('.cell-Collection', this.prepareCollectionTooltip.bind(this));
        
        // Values
        table_body.selectAll('.cell-count')
            .append('span').attr('class', 'value');
        
        // Attach Tooltips
        // To Tweet & Tweet Types
        ['Tweets', 'DistinctTweets', 'Originals', 'Retweets', 'Replies', 'Quotes'].forEach(function(type) {
            
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
        
        // Tooltip with user starts
        this.tooltip.attach('.cell-Users, .cell-Users2orMoreTweets, .cell-Users10orMoreTweets', function(dataset) {
            return {
                Users: dataset['Users'],
                '2+ Tweets': dataset['Users2orMoreTweets'],
                '10+ Tweets': dataset['Users10orMoreTweets'],
                '% 2+ Tweets':  Math.floor(dataset['Users2orMoreTweets'] / dataset['Users'] * 10000) / 100 + '%',
                '% 10+ Tweets':  Math.floor(dataset['Users10orMoreTweets'] / dataset['Users'] * 10000) / 100 + '%'
            }
        });
        
        this.tooltip.attach('.cell-FirstTweet, .cell-LastTweet', function(set) {
            return {
                'First Tweet': set['FirstTweet'],
                'Last Tweet':  set['LastTweet'],
                'Start Time':  util.formatDate(util.twitterID2Timestamp(set['FirstTweet'])),
                'End Time':    util.formatDate(util.twitterID2Timestamp(set['LastTweet'])),
            };
        });
        
        // Add action buttons
        this.addDatasetAction('DatasetActions', 'edit', this.edit, 'Edit the dataset');
        this.addDatasetAction('TweetsActions', 'refresh', this.recount, 'Recount Tweets, Tweet Types, and Start/End Tweet', ['event', 'rumorwithsubset', 'subset']);
        this.addDatasetAction('TweetsActions', 'download-alt',
                              dataset => this.fetchDataToDownload(dataset, 'tweets'),
                              'Download Tweets');
        this.addDatasetAction('TweetsActions', 'download',
                              dataset => this.fetchDataToDownload(dataset, 'tweets_userprofiles'),
                              'Download Tweets & User Profiles');
//        this.addDatasetAction('TweetsActions', 'new-window', this.openCodingReport, 'Open Coding Report');
//        this.addDatasetAction('TweetsActions', 'new-window', this.openFeatureReport, 'Open Feature Report');
        this.addDatasetAction('TimeseriesActions', 'list', this.computeTimeseries, 'Build Timeseries Data');
        this.addDatasetAction('TimeseriesActions', 'refresh', this.countTimeseriesMinutes, 'Recount Timeseries Datapoints (Minutes)');
        this.addDatasetAction('TimeseriesActions', 'scissors action-deletion', this.clearTimeseries, 'Clear Saved Timeseries');
        this.addDatasetAction('TimeseriesActions', 'download-alt',
                              dataset => this.fetchDataToDownload(dataset, 'timeseries'),
                              'Download Timeseries');
//        this.addDatasetAction('TimeseriesActions', 'new-window', this.openTimeseries, 'Open Timeseries Chart in new window');
        this.addDatasetAction('UsersActions', 'list', this.computeUserList, 'Build User List');
        this.addDatasetAction('UsersActions', 'refresh', this.countUsers, 'Recount Users');
        this.addDatasetAction('UsersActions', 'scissors action-deletion', this.clearUserList, 'Clear Saved User List');
        this.addDatasetAction('UsersActions', 'download-alt',
                              dataset => this.fetchDataToDownload(dataset, 'users'),
                              'Download User List');
        this.addDatasetAction('UsersActions', 'download',
                              dataset => this.fetchDataToDownload(dataset, 'users_userprofiles'),
                              'Download User List & User Profiles');
        this.addDatasetAction('UsersActions', 'user', this.enqueueUsersToFetchFollowerQueue.bind(this), 'Fetch followers for users in this dataset by adding them to the queue for the FetchFollowers python script to download using the Twitter API', ['subset']);
        
        // Set initial visibility
        this.event_types_arr.forEach(function(d) { 
            this.setVisibility_Rows_children(d, 'perserve'); 
        }.bind(this), this);
        
        // Set the counts
        triggers.emit('new_counts');
        triggers.emit('toggle columns');
    },
    addDatasetAction: function(action_group, glyphicon, action, tooltip, dataset_types) {
        if(dataset_types == undefined) dataset_types = ['subset', 'event'];
        var selector = dataset_types.map(d => '.row_' + d + ' .cell-' + action_group).join(', ');
        d3.select('tbody').selectAll(selector).append('span')
            .attr('class', 'glyphicon glyphicon-' + glyphicon + ' glyphicon-hoverclick action_button')
            .on('click', action.bind(this))
            .on('mouseover', function(d) {
                this.tooltip.setData(tooltip);
                this.tooltip.on();
            }.bind(this))
            .on('mousemove', function(d) {
                this.tooltip.move(d3.event.x, d3.event.y);
            }.bind(this))
            .on('mouseout', function(d) {
                this.tooltip.off();
            }.bind(this));;
    },
    prepareCollectionContextMenu: function(set) { 
        var collectionType = (set.Level == 1 ? 'Event' : 'Subset')
        var countText_Tweets = set.Tweets ? 'Recount' : 'Count';
        var countText_Timeseries = set.Minutes ? 'Recount' : 'Count';
        var countText_Users = set.Users ? 'Recount' : 'Count';

        var menu_options = [{
                label: collectionType + ' ' + set.ID
            },{
                label: '<span class="glyphicon glyphicon-edit"></span> Edit',
                action: this.edit.bind(this, set) // Gets the original db collection object, as opposed to our modified version
            }];
        return menu_options;
    },
    prepareCollectionTooltip: function(collection) {
        if(collection['CollectionType'] == 'Event Type') {
            return {
                ID:           collection['ID'],
                'Event Type': collection['Label'],
                Events:       collection['events_arr'] ? collection['events_arr'].map(function(event) { return event['Label']; }) : null
            };
        } else if(collection['CollectionType'] == 'Event') {
            return {
                ID:           collection['ID'],
                Event:        collection['Label'],
                'Event Type': collection['Event Type']['Label'],
                Rumors:       collection['rumors_arr'] ? collection['rumors_arr'].map(function(event) { return event['Label']; }) : null
            };
        } else if(collection['CollectionType'] == 'Rumor') {
            return {
                ID:           collection['ID'],
                Rumor:        collection['Label'],
                Event:        collection['Event']['Label'],
                'Event Type': collection['Event Type']['Label'],
                Features:     collection['features_arr'] ? collection['features_arr'].map(function(event) { return event['Label']; }) : null
            };
        } else if(collection['CollectionType'] == 'Feature') {
            return {
                ID:           collection['ID'],
                Feature:      collection['Label'],
                Rumor:        collection['Rumor']['Label'],
                Event:        collection['Event']['Label'],
                'Event Type': collection['Event Type']['Label']
            };
        } else if(collection['CollectionType'] == 'Subset') {
            return {
                ID:           collection['ID'],
                Match:        collection['Match'],
                Feature:      collection['Feature']['Label'],
                Rumor:        collection['Rumor']['Label'],
                Event:        collection['Event']['Label'],
                'Event Type': collection['Event Type']['Label']
            };
        } else {
            return "These subsets don't belong to any specific rumor.";
        }
    },
    setVisibility_Rows_children: function(d, show_children) {
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
        d.row.select('.cell-Collection .glyphicon')
            .classed('glyphicon-chevron-down', show_children)
            .classed('glyphicon-chevron-left', !show_children);
        
        // Add/remove not shown class to subsets as appropriate
        var show_empties = this.ops['Rows']['Empties'].is('table-row');
        d.children.forEach(function(child) {
            var show_child = show_children && (show_empties || !child.row.classed('row-zero'));
            child.row.classed('not_shown', !show_children)
                .style('display', show_child ? 'table-row' : 'none');
            if('children' in child)
                this.setVisibility_Rows_children(child, show_children ? 'perserve' : false);
        }, this)
    },
    setVisibility_Rows: function() {
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
    setVisibility_Columns: function() {
        var table_head = d3.select('thead');
        var table_body = d3.select('tbody');
        var column_group_visibility = {
            Tweets: this.ops['Columns']['Tweet Type Counts'].is('shown'),
            Time: this.ops['Columns']['Dates'].is('shown'),
            Users: this.ops['Columns']['Repeat Users'].is('shown'),
            Actions: this.ops['Columns']['Actions'].is('shown')
        };
        
        this.column_headers.forEach(function(column, i) {
            var column_display = column.always_display || column_group_visibility[column.Group] ?
                null : 'none';
            table_head.select('tr th:nth-child(' + (i+1) + ')')
                .style('display', column_display);
            table_body.selectAll('tr td:nth-child(' + (i+1) + ')')
                .style('display', column_display);
        }, this);
        
        // Turn on/off deletion of data
        table_body.selectAll('.action-deletion')
            .style('display', this.ops['Columns']['Show Deletion'].is('shown') ? null : 'none')
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
        
        table_body.selectAll('.cell-DistinctTweets .value')
            .html(function(dataset) {
                var quantity = 'DistinctTweets';
                var value = dataset[quantity];
                if(!value)
                    return '';
                if(relative == 'raw') {
                    return util.formatThousands(value);
                }
                var denom = relative == 'event'    ? (dataset['Level'] >= 2 ? dataset['Event']['Tweets'] : dataset['Tweets']) : 
                            relative == 'type'     ? (dataset['Level'] >= 2 ? dataset['Event'][quantity] : dataset[quantity]) : 
//                                relative == 'feature'  ? (dataset['Level'] >= 3 ? dataset['Feature Set'][quantity] : dataset[quantity]): 
                            relative == 'subset'   ? dataset['Tweets'] : 
                            relative == 'distinct' ? dataset[quantity] : 1;
                return (value / denom * 100).toFixed(1);
            });
        
        // Set visibility of zero/non-zero rows
        table_body.selectAll('tr')
            .classed('row-zero', function(d) { return !(d.Tweets || d.Minutes) ; });
        
        // Dates
        table_body.selectAll('.cell-FirstTweet')
            .html(function(d) {
                if(!('FirstTweet') in d || d['FirstTweet'] == 0 || d['FirstTweet'] == 1e20) return '';
                if(date_format == 'date') {
                    var date = d.FirstTweet;
                    date = util.twitterID2Timestamp(date);
                    return util.formatDate(date);
                }
                return d.FirstTweet;
            });
        table_body.selectAll('.cell-LastTweet')
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
        table_body.selectAll(".cell-Minutes .value")
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
                var interpol = d3.interpolate(start || 0, d['Minutes'] || 0);

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
        
        // Update regular integer counts
        ['Users','Users2orMoreTweets', 'Users10orMoreTweets'].forEach(function(quantity) {
            table_body.selectAll(".cell-" + quantity + " .value")
                .transition()
                .duration(1000)
                .tween("text", function (d) {
                    var start = this.textContent;
                    if(typeof(start) == 'string') {
                        start = parseInt(start.replace(/ /g, ''));
                    }
                    var interpol = d3.interpolate(start || 0, d[quantity] || 0);

                    return function (value) {
                        if(typeof(value) == 'string') {
                            value = parseInt(value.replace(/ /g, ''));
                        }
                        value = Math.round(interpol(value));
                        this.textContent = util.formatThousands(value);
                    };
                });
        }, this);
        
        triggers.emit('refresh_visibility');
    },
    edit: function(collection) {
        if(collection.Level == 1) { // Event
            this.dataset.event = collection;
            triggers.emit('edit collection:open', 'event');
        } else if(collection.Level == 4) { // Subset
            // If the object is modified, change how some of the fields are handled
            if('Event_ID' in collection) {
                collection = {
                    ID: collection.ID,
                    Event: collection.Event.ID,
                    Rumor: collection.Rumor.ID,
                    Superset: collection.Superset,
                    Feature: collection.Feature.Label,
                    Match: collection.Match,
                    Notes: collection.Notes
                };
            }
            
            this.dataset.subset = collection;
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
    recount: function(dataset) {
        // Prepare statement
        var post = {
            Collection: dataset.Level == 1 ? 'event' : 'subset',
            ID: dataset.Subset_ID || dataset.ID,
        }
        
        // Start loading sign
        var prog_bar = new Progress({
            'initial': 100,
            'parent_id': this.datasetRowID(dataset) + ' .cell-Tweets',
            style: 'full', 
            text: ' '
        });
        prog_bar.start();
        
        // Start the recount
        this.connection.phpjson('collection/recount', post, function(result) {     
            result = result[0];
            
            this.quantities.forEach(function (quantity) {
                dataset[quantity] = parseInt(result[quantity]) || 0;
            });
            dataset['FirstTweet'] = result['FirstTweet'] ? new BigNumber(result['FirstTweet']) : new BigNumber('0');
            dataset['LastTweet']  = result['LastTweet']  ? new BigNumber(result['LastTweet'])  : new BigNumber('0');
            
            triggers.emit('update_counts', this.datasetRowID(dataset));

            // Remove loading sign
            prog_bar.end();
        }.bind(this),
        function(badresult) {
            console.log(badresult);
            prog_bar.update(100, 'Error');
        });
    },
    clearTimeseries: function(dataset) {
        this.connection.phpjson(
            'timeseries/clear',
            {
                Collection: dataset.Level == 1 ? 'Event' : 'Subset',
                ID: dataset.ID,
            },
            this.countTimeseriesMinutes.bind(this, dataset)
        );
    },
    countTimeseriesMinutes: function(dataset) {
        this.connection.phpjson(
            'timeseries/count',
            {
                Collection: dataset.Level == 1 ? 'Event' : 'Subset',
                ID: dataset.ID,
            },
            this.updateTimeseriesMinutesDisplay.bind(this, dataset)
        );
    },
    computeTimeseries: function(dataset) {
        var args = {
            url: 'timeseries/compute',
            post: {
                Collection: dataset.Level == 1 ? 'Event' : 'Subset',
                ID: dataset.ID,
                json: true,
            },
            quantity: 'tweet',
            min: dataset.FirstTweet,
            max: dataset.LastTweet,
            progress_div: this.datasetRowID(dataset) + ' .cell-Minutes',
            progress_text: ' ',
            progress_style: 'full',
            on_chunk_finish: this.updateTimeseriesMinutesDisplay.bind(this, dataset)
        }
        
        var conn = new Connection(args);
        conn.startStream();
    },
    updateTimeseriesMinutesDisplay: function(dataset, result) {
        dataset['Minutes'] = parseInt(result[0]['Minutes']);
                
        triggers.emit('update_counts', this.datasetRowID(dataset));
    },
    countUsers: function(dataset) {
        this.connection.phpjson(
            'users/countInCollection',
            {
                Collection: dataset.Level == 1 ? 'Event' : 'Subset',
                ID: dataset.ID,
            },
            this.updateUserCountDisplay.bind(this, dataset)
        );
    },
    clearUserList: function(dataset) {
        this.connection.phpjson(
            'users/clearUsersInCollection',
            {
                Collection: dataset.Level == 1 ? 'Event' : 'Subset',
                ID: dataset.ID,
            },
            this.countUsers.bind(this, dataset)
        );
    },
    computeUserList: function(dataset) {
        this.connection.phpjson(
            'users/getUserLastCounted',
            {
                Collection: dataset.Level == 1 ? 'Event' : 'Subset',
                ID: dataset.ID,
            },
            this.computeUserStream.bind(this, dataset)
        );
    },
    computeUserStream: function(dataset, lastTweet) {
        var firstTweet = lastTweet != undefined && lastTweet[0] && 'MAX(LastTweetID)' in lastTweet[0] && lastTweet[0]['MAX(LastTweetID)'] ? new BigNumber(lastTweet[0]['MAX(LastTweetID)']) : dataset.FirstTweet;
        
        var args = {
            url: 'users/computeUsersInCollection',
            post: {
                Collection: dataset.Level == 1 ? 'Event' : 'Subset',
                ID: dataset.ID,
                json: true,
            },
            quantity: 'tweet',
            min: firstTweet,
            max: dataset.LastTweet,
            resolution: 0.25,
            progress_div: this.datasetRowID(dataset) + ' .cell-Users',
            progress_text: ' ',
            progress_style: 'full',
            on_chunk_finish: function(result) {
                dataset['Users'] = parseInt(result[0]['Users']);
                dataset['Users2orMoreTweets'] = parseInt(result[0]['Users2orMoreTweets']);
                dataset['Users10orMoreTweets'] = parseInt(result[0]['Users10orMoreTweets']);
                
                triggers.emit('update_counts', this.datasetRowID(dataset));
            }.bind(this)
        }
        
        var conn = new Connection(args);
        conn.startStream();
    },
    updateUserCountDisplay: function(dataset, queryResult) {
        dataset['Users'] = parseInt(queryResult[0]['Users']);
        dataset['Users2orMoreTweets'] = parseInt(queryResult[0]['Users2orMoreTweets']);
        dataset['Users10orMoreTweets'] = parseInt(queryResult[0]['Users10orMoreTweets']);

        triggers.emit('update_counts', this.datasetRowID(dataset));
    },
    enqueueUsersToFetchFollowerQueue: function(dataset) {
        this.connection.phpjson(
            'users/enqueueToFetchFollowerQueue',
            {
                Collection: dataset.Level == 1 ? 'Event' : 'Subset',
                ID: dataset.ID,
            },
            triggers.emitter('alert', {
                text: 'Sent ' + dataset.Users + ' Users to the Follower Fetching Queue. May take awhile.',
                style_class: 'info'
            })
        );
    },
    datasetRowID: function(dataset) {
        return '.row_' + dataset.CollectionType.toLowerCase() + '_' + dataset.ID;
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
        
//        div.append('button')
//            .attr('class', 'btn btn-default new-collection-button')
//            .text('Add Tweets to Event')
//            .on('click', triggers.emitter('alert', 'Sorry this button doesn\'t work yet'));
//        
//        div.append('button')
//            .attr('class', 'btn btn-default new-collection-button')
//            .text('Add Tweets to Subset')
//            .on('click', triggers.emitter('alert', 'Sorry this button doesn\'t work yet'));
        
        div.append('button')
            .attr('class', 'btn btn-default new-collection-button')
            .text('End Download')
            .on('click', this.endDownload.bind(this));
        
        // Only here to move tweets from old version of the tweet table to new version if necessary
//        div.append('button')
//            .attr('id', 'tweet-transfer')
//            .attr('class', 'btn btn-default new-collection-button')
//            .text('Transfer Tweets')
//            .on('click', this.transferTweets.bind(this));
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
    },
    fetchDataToDownload: function(dataset, dataType) {
        var collection_type = dataset.CollectionType;
        var collection_id = dataset.ID;
        var url = dataType.includes('tweets') ? 'tweets/get' :
                  dataType.includes('timeseries') ? 'timeseries/get' :
                  dataType.includes('users') ? 'users/get' : 'tweets/getUsers';
        var pk_query = dataType.includes('tweets') ? 'tweet_min' :
                  dataType.includes('timeseries') ? 'time_min' :
                  dataType.includes('users') ? 'user_min' : 'tweet_min';
        var pk_table = dataType.includes('tweets') ? 'ID' :
                  dataType.includes('timeseries') ? 'Time' :
                  dataType.includes('users') ? 'UserID' : 'ID';
        var nEntries = dataType.includes('tweets') ? dataset.Tweets :
                  dataType.includes('timeseries') ? dataset.Minutes :
                  dataType.includes('users') ? dataset.Users : dataset.Tweets;
        
        if(this.download.stream) {
            triggers.emit('alert', 'Cannot download data, existing download stream is running');
        }
        
        this.download = {
            stream: false,
            dataset: dataset,
            data: [],
            datatype: dataType,
            filename: dataType + '_' + collection_type + '_' + collection_id + '.csv'
        };
        
        var post = {
            collection: collection_type,
            collection_id: collection_id,
            extradata: '',
            json: true,
        };
        
        if(dataType.includes('profiles'))
            post.extradata += 'u';
        if(dataType.includes('parents'))
            post.extradata += 'p';
        
        // Initialize the connection
        this.download.stream = new Connection({
            url: url,
            post: post,
            quantity: 'count',
            resolution: 5000,
            max: nEntries,
            pk_query: pk_query,
            pk_table: pk_table,
            on_chunk_finish: this.parseNewDownloadData.bind(this),
            on_finish: this.endDownload.bind(this),
            progress_text: '{cur}/{max} Fetched for Download',
        });
        
        // Start the connection
        this.download.stream.startStream();
    },
    parseNewDownloadData: function(newData) {        
        // End early if no more data
        if(newData.length == 0) {
            this.endDownload();
        }
        
        $.merge(this.download.data, newData);
    },
    endDownload: function() {
        this.download.stream.stop();
        this.download.stream.progress.end();
        
        var data = this.download.data;
        if(data.length == 0) {
            triggers.emitter('alert','Unable to downlad ' + this.download.datatype);
        } else {
            // Strip some disruptive characters
            data.forEach(function(datum) {
                if('Text' in datum)
                    datum.Text = datum.Text.replace(/(?:\r\n|\r|\n)/g, ' ');
                if('Description' in datum && datum.Description)
                    datum.Description = datum.Description.replace(/(?:\r\n|\r|\n)/g, ' ');
    //            var text_no_url = tweet.Text.replace(/(?:http\S+)/g, ' ');
    //            
    //            if(tweet_text_unique.has(text_no_url)) {
    //                tweet.Distinct = 0;
    //            } else {
    //                tweet_text_unique.add(text_no_url);
    //                if(tweets_unique.length < 100) {
    //                    tweets_unique.push(tweet);
    //                }
    //            }
            });
            
            // Send data to user
            this.fileDownload(d3.csv.format(data), this.download.filename, 'text/csv');
        }

        // Erase local data
        this.download = {
            stream: false,
            dataset: false,
            data: [],
            datatype: '',
            filename: ''
        };
    },
    fileDownload: function(content, fileName, mimeType) {
//        var a = document.createElement('a');
        var fileName = fileName || 'data.csv';
        var mimeType = mimeType || 'text/csv'; // 'application/octet-stream'; // "application/csv;charset=utf-8;"

        var blob = new Blob([ content ], {type : mimeType});
        if (window.navigator.msSaveBlob) {
            // FOR IE BROWSER
            navigator.msSaveBlob(blob, fileName);
        } else {
            // FOR OTHER BROWSERS
            var link = document.createElement("a");
            var csvUrl = URL.createObjectURL(blob);
            link.href = csvUrl;
            link.style = "visibility:hidden";
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        
//        if (navigator.msSaveBlob) { // IE10
//            return navigator.msSaveBlob(new Blob([content], { type: mimeType }), fileName);
//        } else if ('download' in a) { //html5 A[download]
//            a.href = 'data:' + mimeType + ',' + encodeURIComponent(content);
//            a.setAttribute('download', fileName);
//            document.body.appendChild(a);
//            setTimeout(function() {
//                a.click();
//                document.body.removeChild(a);
//            }, 66);
//            return true;
//        } else { //do iframe dataURL download (old ch+FF):
//            var f = document.createElement('iframe');
//            document.body.appendChild(f);
//            f.src = 'data:' + mimeType + ',' + encodeURIComponent(content);
//
//            setTimeout(function() {
//                document.body.removeChild(f);
//            }, 333);
//            return true;
//        }
    },
};

function initialize() {
    DT = new DatasetTable();
    
    DT.init();
}
window.onload = initialize;