function CollectionManager(app, args) {
    this.app = app;
    args = args || {};
    this.name = args.name || 'Dataset';
    
    this.flag_subset_menu = false;
    this.flag_sidebar = true;
    this.flag_allow_edits = true;
    this.flag_allow_new = true;
    this.flag_secondary_event = false;
    this.flag_time_window = true;
    
    Object.keys(args).forEach(function(arg) {
        if(arg.includes('flag')) {
            this[arg] = args[arg];
        }
    }, this);

    this.ops = {};
    
    this.event_names;
    this.events_arr;
    this.events;
    this.event;
    
    this.rumors_arr;
    this.rumors;
    this.rumor;
    
    this.time = {};

    this.subsets_arr;
    this.subsets;
    this.subset;
    
    this.event2;
    this.subsets2_arr;
    this.subsets2;
    this.subset2;
    
    this.init();
    
    /* Edit Window constants */
    this.editing = {};
    this.edit_window_fields = {
        omitted: ['Tweets', 'Originals', 'Retweets', 'Replies', 'Quotes',
                 'DistinctTweets', 'DistinctOriginals', 'DistinctRetweets', 'DistinctReplies', 'DistinctQuotes',
                 'TweetsDisplay', 'OriginalsDisplay', 'RetweetsDisplay', 'RepliesDisplay', 'QuotesDisplay',
                 'Level', 'Datapoints', 'Label', 'FirstTweet', 'LastTweet',
                 'Month', 'DisplayMatch', 'type'],
        id: ['ID', 'Event', 'Rumor'],
        text: ['DisplayName', 'Superset', 'Feature', 'Match', 'Notes', 'Level', 'Type', 'Description', 'Active'],
        date: ['StartTime', 'StopTime'],
        textarea: ['Description', 'Definition'],
        query: ['Query']
    };
    
    this.fieldValues = {
        Timezone: [
            {label: 'UTC-10, Hawaii', value: -10*60*60},
            {label: 'UTC-09, Alaska', value: -9*60*60},
            {label: 'UTC-08, US West', value: -8*60*60},
            {label: 'UTC-07, US Mountain <small>US West DST</small>', value: -7*60*60},
            {label: 'UTC-06, US Central & Mexico <small>US Mountain DST</small>', value: -6*60*60},
            {label: 'UTC-05, US East & NW South America <small>US Central DST</small>', value: -5*60*60},
            {label: 'UTC-04, Altantic & Venezuela <small>US East DST</small>', value: -4*60*60},
            {label: 'UTC-03, Brazil <small>Atlantic DST</small>', value: -3*60*60},
            {label: 'UTC-02, <small>Brazil DST</small>', value: -2*60*60},
            {label: 'UTC+00, Western Europe & Africa', value: 0*60*60},
            {label: 'UTC+01, Central Europe & Africa <small>Western Europe DST</small>', value: 1*60*60},
            {label: 'UTC+02, Eastern Europe, South Africa <small>Central Europe DST</small>', value: 2*60*60},
            {label: 'UTC+03, Russia - Moscow, East Africa <small>Eastern Europe DST</small>', value: 3*60*60},
            {label: 'UTC+03.5, Iran', value: 3.5*60*60},
            {label: 'UTC+04, Urals', value: 4*60*60},
            {label: 'UTC+04.5, Afghanistan <small>Iran DST</small>', value: 4.5*60*60},
            {label: 'UTC+05, Central Asia', value: 5*60*60},
            {label: 'UTC+05.5, India', value: 5.5*60*60},
            {label: 'UTC+06, Kazakhstan', value: 6*60*60},
            {label: 'UTC+07, Siberia, SE Asia', value: 7*60*60},
            {label: 'UTC+08, China', value: 8*60*60},
            {label: 'UTC+09, Japan', value: 9*60*60},
            {label: 'UTC+10, Australia - Sydney', value: 10*60*60},
            {label: 'UTC+11, <small>Australia - Sydney DST</small>', value: 11*60*60}
        ], 
        TweetSource: [
            {label: 'Capture Client', value: 'Capture Client'},
            {label: 'Combination of other Events', value: 'Combination of other Events'},
            {label: 'Analysis Set', value: 'Analysis Set'},
            {label: 'Old Collection', value: 'Old Collection'},
            {label: 'Other', value: 'Other'}
        ]};
    this.fieldValues.Timezone.forEach(d => d.label += ' (' + d.value + ')');
    
    this.collection_fields = {
        event: [
            {label: 'ID',                 name: 'ID',          type: 'Text',     final: true},
            {label: 'Event Type',         name: 'Type',        type: 'Enum',     list: function() {
                 // Hack only used by dataset_table.js
                return SR.event_types_arr.map(d => {
                    return {label: d.Label, value: d.Label};
                });
            }},
            {label: 'Name (Displayed)',   name: 'DisplayName', type: 'Text'},
            {label: 'Name (Original)',    name: 'Name',        type: 'Text',     final: true, new_editable: true},
            {label: 'Description',        name: 'Description', type: 'Textarea'},
            {label: 'Final Keywords',     name: 'Keywords',    type: 'Textarea', final: true, new_editable: true},
            {label: 'Temporary Keywords', name: 'OldKeywords', type: 'Textarea', final: true},
            {label: 'Capture Start',      name: 'StartTime',   type: 'Date'},
            {label: 'Capture Stop',       name: 'StopTime',    type: 'Date'},
            {label: 'Timezone',           name: 'UTCOffset',   type: 'Enum',     list: this.fieldValues.Timezone},
            {label: 'Tweet Source',       name: 'TweetSource', type: 'Enum',     list: this.fieldValues.TweetSource},
            {label: 'Server',             name: 'Server',      type: 'String',   final: true},
            {label: 'Active',             name: 'Active',      type: 'Boolean'},
            // Provide Statistics?
        ],
        subset: [
            {label: 'ID',       name: 'ID',       type: 'Text',     final: true},
            {label: 'Event',    name: 'Event',    type: 'Enum',     list: function() {
                // Hack only used by dataset_table.js
                var list = SR.events_arr.map(d => {
                    return {label: d.Label + ' (' + d.ID + ')', value: d.ID};
                });
                list.unshift({label: 'No Event (0)', value: 0});
                return list;
            }},
            {label: 'Rumor',    name: 'Rumor',    type: 'Enum',     list: function() {
                // Hack only used by dataset_table.js
                var list = SR.rumors_arr.map(d => {
                    return {label: d.Label + ' (' + d.ID + ')', value: d.ID};
                });
                list.unshift({label: 'No Rumor (0)', value: 0});
                return list;
            }},
            {label: 'Superset', name: 'Superset', type: 'Enum',     list: function() {
                 // Hack only used by dataset_table.js
                var list = SR.subsets_arr.map(d => {
                    return {label: d.FeatureMatch + ' (' + d.ID + ')', value: d.ID};
                });
                list.unshift({label: 'No Superset (0)', value: 0});
                return list;
            }},
            {label: 'Feature',  name: 'Feature', type: 'Enum',     list: function() {
                 // Hack only used by dataset_table.js
                return util.lunique(SR.features_arr.map(d => d.Label))
                    .map(d => {
                        return {label: d, value: d};
                    });
            }},
            {label: 'Match',    name: 'Match',    type: 'Text'},
            {label: 'Notes',    name: 'Notes',    type: 'Text'}
        ]
    };
    
    this.blank_collection = {
        'event': {
            Label: "New Collection",
            ID: 0,
            Type: "",
            DisplayName: "",
            Name: "",
            Description: "",
            Keywords: "",
            OldKeywords: "",
            StartTime: util.formatDate(new Date()),
            StopTime: util.formatDate(new Date()),
            Server: "ad hoc",
            Active: 1,
            FirstTweet: 0, LastTweet: 0,
            Tweets: 0, DistinctTweets: 0,
            Originals: 0, DistinctOriginals: 0,
            Retweets: 0, DistinctRetweets: 0,
            Replies: 0, DistinctReplies: 0,
            Quotes: 0, DistinctQuotes: 0,
            Minutes: 0,
            TweetSource: "",
            UTCOffset: -28800
        },
        'subset': {
            Label: 'New Subset',
            ID: '',
            Event: '',
            Rumor: '',
            Superset: '',
            Feature: '',
            Match: '',
            Notes: '',
            Feature: ''
        }
    }
}
CollectionManager.prototype = {
    init: function() {
        this.setTriggers();
    },
    setTriggers: function() {
        triggers.on('collectionManager:setOptions', this.setOptions.bind(this));
        triggers.on('collectionManager:build', this.build.bind(this));
        
        // Dataset changes
        if(this.flag_sidebar) {
            triggers.on('events:load', this.loadEvents.bind(this));
            triggers.on('events:load', this.loadRumors.bind(this));
            triggers.on('events:updated', this.populateEventOptions.bind(this));
            triggers.on('event_type:set', this.chooseEventType.bind(this));
            triggers.on('event:set', this.setEvent.bind(this));
            triggers.on('event:updated', this.loadSubsets.bind(this, ''));
            if(this.flag_subset_menu) {
                triggers.on('subsets:updated', this.populateSubsetOptions.bind(this, ''));
                triggers.on('subset:set', this.setSubset.bind(this, ''));
            }
            
            if(this.flag_secondary_event) {
                triggers.on('events:updated', // or event_type:set or ??
                            this.populateEvent2Options.bind(this));
                triggers.on('event2:set', this.setEvent2.bind(this));
                triggers.on('event2:updated', this.loadSubsets.bind(this, '2'));
                if(this.flag_subset_menu) {
                    triggers.on('subsets2:updated', this.populateSubsetOptions.bind(this, '2'));
                    triggers.on('subset2:set', this.setSubset.bind(this, '2'));
                }
            }
        }

        // Editing Windows
        if(this.flag_allow_edits) {
            triggers.on('edit collection:new', this.editWindow.bind(this, 'new'));
            triggers.on('edit collection:open', this.editWindow.bind(this, 'existing'));
            triggers.on('edit collection:changed', this.editWindowChanged.bind(this));
            triggers.on('edit collection:update', this.updateCollection.bind(this));
            triggers.on('edit collection:verify update', this.verifyCollectionUpdate.bind(this));
        }
        
        // Time Setter
        if(this.flag_time_window) {
            triggers.on('time_window:edit', this.editLoadTimeWindow.bind(this));
            triggers.on('time_window:choose', function() {
                if(this.ops['Time Window'].is('custom')) {
                    triggers.emit('time_window:edit');
                } else {
                    triggers.emit('time_window:set');
    //                triggers.emit('event:load_timeseries');
                }
            }.bind(this));
            triggers.on('time_window:set', this.configureLoadTimeWindow.bind(this));  
            triggers.on('event:updated', this.configureLoadTimeWindow.bind(this));  
        }
    },
    build: function() {
//        this.setOptions(); // Instead, when setting options for an app, it should trigger 'collectionManager:setOptions'
        triggers.emit('events:load');
    },
    setOptions: function() {
        var dropdowns = ['Event Type', 'Event'];
        this.ops = {
            'Event Type': new Option({
                title: "Type",
                labels: ["All", "Other Type"],
                ids:    ["All", "Other Type"],
                custom_entries_allowed: true,
                callback: triggers.emitter('event_type:set')
            }),
            Event: new Option({
                title: "Event",
                labels: ["none"],
                ids:    ["none"],
                custom_entries_allowed: true,
                callback: triggers.emitter('event:set')
            })
        };
        if(this.flag_allow_edits) {
            this.ops['Event'].edit = triggers.emitter('edit collection:open', 'event');
        }
        if(this.flag_subset_menu) {
            dropdowns.push('Subset');
            this.ops['Subset'] = new Option({
                title: "Subset",
                labels: ["none"],
                ids:    ["none"],
                custom_entries_allowed: true,
//                type: 'dropdown_autocomplete',
                callback: triggers.emitter('subset:set')
            });
            if(this.flag_allow_edits) {
                this.ops['Subset'].edit = triggers.emitter('edit collection:open', 'subset');
            }
        }
        if(this.flag_secondary_event) {
            dropdowns.push('Event2');
            this.ops['Event2'] = new Option({
                title: "Event B",
                labels: ["none"],
                ids:    ["none"],
                custom_entries_allowed: true,
                callback: triggers.emitter('event2:set')
            });
            if(this.flag_allow_edits) {
                this.ops['Event2'].edit = triggers.emitter('edit collection:open', 'event2');
            }
            
            if(this.flag_subset_menu) {
                dropdowns.push('Subset2');
                this.ops['Subset2'] = new Option({
                    title: "Subset B",
                    labels: ["none"],
                    ids:    ["none"],
                    custom_entries_allowed: true,
                    callback: triggers.emitter('subset2:set')
                });
                if(this.flag_allow_edits) {
                    this.ops['Subset2'].edit = triggers.emitter('edit collection:open', 'subset2');
                }
            }
        }
        if(this.flag_time_window) {
            dropdowns.push('Time Window');
            this.ops['Time Window'] = new Option({
                title: "Time",
                labels: ["First Hour", "First Day", "First 3 Days", "First Week", "Whole Collection", "Custom",],
                ids:    ['1h', '1d', '3d', '1w', 'all', 'custom'],
                callback: triggers.emitter('time_window:choose'),
                edit: triggers.emitter('time_window:edit')
            });
            this.ops['Time Min'] = new Option({
                title: "Time Min",
                labels: [''],
                ids: [''],
                date: new Date(),
                hidden: true,
                custom_entries_allowed: true
            });
            this.ops['Time Max'] = new Option({
                title: "Time Max",
                labels: [''],
                ids: [''],
                date: new Date(),
                hidden: true,
                custom_entries_allowed: true
            });
        }
        
        // Save to main options menu and build dropdowns
        this.app.ops[this.name] = this.ops;
//        dropdowns.forEach(function(option_name) {
//            this.app.ops.buildSidebarOption(this.name, option_name);
//        }, this);
    },
    loadEvents: function () {
        // Event selection
        this.app.connection.php('collection/getEvent', {},
                     this.parseEventsFile.bind(this));
    },
    parseEventsFile: function (data) {
        // Add events (collections)
        try {
            this.events_arr = JSON.parse(data);
        } catch(err) {
            console.error(data);
            throw(err);
        }
        this.events_arr.sort(util.compareCollections);
        this.events_arr.reverse();
        
        this.events = {};
        this.events_arr.forEach(function(event) {
            this.events[event['ID']] = event;
        }, this);
        
        // Format collection data
        this.events_arr.forEach(function (event) {
            // Keywords
            event.Keywords = event['Keywords'] ? event.Keywords.trim().split(/,[ ]*/) : [];
            event.OldKeywords = event['OldKeywords'] ? event.OldKeywords.trim().split(/,[ ]*/) : [];
            if (event.OldKeywords.length == 1 && event.OldKeywords[0] == "")
                event.OldKeywords = [];
            
            // Name
            if (!('DisplayName' in event) || !event['DisplayName'] || event['DisplayName'] == "null") {
                event.Label = event.Name;
                event.DisplayName = '';
            } else {
                event.Label = event.DisplayName;
            }
               
            // Time
            event.StartTime = event.StartTime ? util.date(event.StartTime) : new Date();
//            collection.StartTime.setMinutes(collection.StartTime.getMinutes()
//                                           -collection.StartTime.getTimezoneOffset());
            event.Month = util.date2monthstr(event.StartTime);
            if (event.StopTime) {
                event.StopTime = util.date(event.StopTime);
                if (event.StartTime.getMonth() != event.StopTime.getMonth() ) 
                    event.Month += ' to ' + util.date2monthstr(event.StopTime);
            } else {
                event.StopTime = "Ongoing";
                event.Month += '+';
            }
            event.Label += ' ' + event.Month;
        });

        
        // Make nicer event names
        this.event_names = this.events_arr.map(function (event) {
            return event.Label;
        });
        
        triggers.emit('events:updated');
    },
    setEvent: function () {
        var event_id = this.ops['Event'].get();
        this.event = this.events[parseInt(event_id)];
        
        // Save times for the collection
        // TODO fix when times are stale
        this.time.event_min = util.twitterID2Timestamp(this.event.FirstTweet);
        this.time.event_max = util.twitterID2Timestamp(this.event.LastTweet);
        
//        this.time.event_min = new Date(this.event.StartTime);
//        if(this.event.StopTime == "Ongoing") {
//            this.time.event_max = new Date();
//        } else {
//            this.time.event_max = new Date(this.event.StopTime);
//        }
//        
//        global_min_id = this.event.FirstTweet || util.timestamp2TwitterID(this.ime.event_min);
//        global_max_id = this.event.LastTweet  || util.timestamp2TwitterID(this.time.event_max);
        
        triggers.emit('event:updated', this.event);
    },
    setEvent2: function () {
        var event_id = this.ops['Event2'].get();
        this.event2 = this.events[parseInt(event_id)];
        
        triggers.emit('event2:updated', this.event2);
    },
    setSubset: function(version) {
        var subset_id = this.ops['Subset' + version].get();
        if(!('subsets' + version in this)) return;
        this['subset' + version] = this['subsets' + version][parseInt(subset_id)];
        
        triggers.emit('subset' + version + ':updated', this['subset' + version]);
    },
    updateCollection: function() {
        var fields = {};
        $("#edit_form").serializeArray().forEach(function(x) { fields[x.name] = x.value; });
        console.log(fields);
        
        this.app.connection.php('collection/update', fields, triggers.emitter('edit collection:verify update')); // add a callback
    },
    verifyCollectionUpdate: function(message) {
        if(message.includes('Success')) {
            triggers.emit('events:load');
            
            // Turn update to normal
            d3.select('#edit-window-save')
                .attr('class', 'btn btn-default');

            // Unlock Match/Fetch buttons
            d3.selectAll('.edit-window-routine')
                .attr('disabled', null);
            
            // TODO refresh the dataset table when we have created a new set
        } else {
            console.error(message);
            if(message.indexOf('Error: Data truncated for column \'TweetSource\'') > 0) {
                // TODO provide a richer error description
//                var badFieldName = '`TweetSource`=';
//                var badFieldStart = message.indexOf(badFieldName);
//                var badFieldValue = message.substring(badFieldStart + badFieldName.length,
//                                                      message.indexOf("'", badFieldStart + badFieldName.length));
                alert("Invalid value for 'TweetSource', " +
                      "must be on the list: [" + this.fieldValues.TweetSource.map(d => d.value).join(', ') + "]");
            }
            // TODO handle other errors like other bad fields
        }
    },
    loadRumors: function () {
        this.app.connection.php('collection/getRumor', {},
             this.parseRumorsFile.bind(this));
    },
    loadSubsets: function (version) {
        if(this['event' + version] && this['event' + version].ID) {
            this.app.connection.php('collection/getSubset', {event: this['event' + version].ID},
                 this.parseSubsetsFile.bind(this, version));
        }
    },
    parseRumorsFile: function(filedata) {
        try {
            filedata = JSON.parse(filedata);
        } catch (exception) {
            console.log(filedata);
            return;
        }
        
        this.rumors = {};
        this.rumors_arr = filedata;
        this.rumors_arr.forEach(function(rumor) {
            this.rumors[rumor.ID] = rumor;
        }, this);
    },
    parseSubsetsFile: function(version, filedata) {
        try {
            filedata = JSON.parse(filedata);
        } catch (exception) {
            console.log(filedata);
            return;
        }
        
        this['subsets' + version] = {};
        this['subsets' + version + '_arr'] = filedata;
        this['subsets' + version + '_arr'].forEach(function(subset) {
            subset.rumor = {};
            
            // Get formatted display name
            subset.DisplayMatch = util.subsetName({
                feature: subset.Feature,
                match: subset.Match
            });
            
            // If subset IS a rumor
            if(subset.Feature == 'Rumor') {
                subset.rumor = this.rumors[subset.Match];
                subset.DisplayMatch = subset.rumor.Name;
            }
            
            // Make Label
            subset.Label = '<small>' + subset.Feature + ':</small> ' + subset.DisplayMatch;
            
            // Add rumor if the subset is under a rumor
            subset.DisplayMatchWithRumor = subset.DisplayMatch;
            if(subset.Rumor != '0') {
                subset.rumor = this.rumors[subset.Rumor];
                subset.Label = '<em><small>' + subset.rumor.Name + '</small></em> ' + subset.Label;
                subset.DisplayMatchWithRumor += ' <em><sup>' + subset.rumor.Name + '</sup></em>';
            }
            
            this['subsets' + version][subset.ID] = subset;
        }, this);
        
        triggers.emit('subsets' + version + ':updated');
    },
    populateEventOptions: function() {
        var event_op = this.ops['Event'];
        var event_type_op = this.ops['Event Type'];
        
        // Generate Collections List
        event_op['labels'] = this.event_names;
        event_op['ids'] = this.events_arr.map(function(event) { return event['ID']; });
        event_op['available'] = util.range(this.events_arr.length);
        
        // Find the current collection
        var cur = event_op.get();
        event_op.default = this.events_arr.reduce(function(candidate, event, i) {
            if(event['ID'] == cur)
                return i;
            return candidate;
        }, 0);
        event_op.set(event_op['ids'][event_op.default]);
        
        // Make the dropdown
        this.app.ops.buildSidebarOption(this.name, 'Event');
        this.app.ops.recordState(true);
        triggers.emit('event:set');
        
        // Generate Types of Collections
        var types = util.lunique(this.events_arr.map(function(event) { return event['Type']; }));
        types.unshift('All'); // Add 'All' to begining
        
        event_type_op['labels'] = types;
        event_type_op['ids'] = types;
        event_type_op['available'] = util.range(types.length);
        
        // Set the type to match the current collection
        event_type_op.default = event_type_op['ids'].indexOf(this.events_arr[event_op.default]['Type']);
        event_type_op.set(types[event_type_op.default]);
        
        // Make the dropdown for collection types
        this.app.ops.buildSidebarOption(this.name, 'Event Type');
        this.app.ops.recordState(true);

        // Add additional information for events
        this.app.tooltip.attach('#choose_l' + this.name + '_lEvent a', function(d) {
            var event = this.events_arr[d];
            event = JSON.parse(JSON.stringify(event));

            ['Tweets', 'Originals', 'Retweets', 'Replies', 'Quotes'].forEach(function(quantity) {
                event[quantity + ' <small>(Distinct)</small>'] = util.formatThousands(event[quantity]);
                if(event['Distinct' + quantity]) {
                    event[quantity + ' <small>(Distinct)</small>'] += 
                        ' <small style="left: 200px; position: absolute">(' +
                        util.formatThousands(event['Distinct' + quantity]) + ')</small>'; 
                }
                delete event[quantity];
                delete event['Distinct' + quantity];
            });

            return event;
        }.bind(this));

        // Limit the collection selections to the particular type
        triggers.emit('event_type:set');
    },
    populateEvent2Options: function() { // TODO verify this works and what is strange about it, looks like tooltips have problems
        var event2_op = this.ops['Event2'];
        var event_op = this.ops['Event'];
        
        // Generate Collections List
        event2_op['labels'] = event_op['labels'].slice(0);
        event2_op['labels'].unshift('<em>None</em>');
        event2_op['ids'] = event_op['ids'].slice(0);
        event2_op['ids'].unshift('<em>None</em>');
        event2_op['available'] = util.range(event2_op['labels'].length);
        
        // Find the current collection
        var cur = event2_op.get();
        event2_op.default = this.events_arr.reduce(function(candidate, event, i) {
            if(event['ID'] == cur)
                return i + 1;
            return candidate;
        }, 0);
        event2_op.set(event2_op['ids'][event2_op.default]);
        
        // Make the dropdown
        this.app.ops.buildSidebarOption(this.name, 'Event2');
        this.app.ops.recordState(true);
        triggers.emit('event2:set');

        // Add additional information for events
        this.app.tooltip.attach('#choose_l' + this.name + '_lEvent2 a', function(d) {
            var event = this.events_arr[d];
            event = JSON.parse(JSON.stringify(event));

            ['Tweets', 'Originals', 'Retweets', 'Replies', 'Quotes'].forEach(function(quantity) {
                event[quantity + ' <small>(Distinct)</small>'] = util.formatThousands(event[quantity]);
                if(event['Distinct' + quantity]) {
                    event[quantity + ' <small>(Distinct)</small>'] += 
                        ' <small style="left: 200px; position: absolute">(' +
                        util.formatThousands(event['Distinct' + quantity]) + ')</small>'; 
                }
                delete event[quantity];
                delete event['Distinct' + quantity];
            });

            return event;
        }.bind(this));
    },
    populateSubsetOptions: function(version) {
        var subsets_arr = this['subsets' + version + '_arr'];
        var subset_names = subsets_arr.map(function(subset) {
            return subset.Label;
        });
        
        // Generate Collections List
        subset_op = this.ops['Subset' + version];
        subset_op['labels'] = subset_names;
        subset_op['labels'].unshift('<em>None</em>');
        subset_op['labels'].push('- New -');
        subset_op['ids'] = subsets_arr.map(function(subset) { return subset['ID']; });
        subset_op['ids'].unshift('_none_');
        subset_op['ids'].push('_new_');
        subset_op['available'] = util.range(subset_op['labels'].length);
        
        // Find the current collection
        var cur = subset_op.get();
        subset_op.default = subsets_arr.reduce(function(candidate, subset, i) {
            if(subset['ID'] == cur)
                return i + 1;
            return candidate;
        }, 0);
        subset_op.set(subset_op['ids'][subset_op.default]);
        
        // Make the dropdown
        this.app.ops.buildSidebarOption(this.name, 'Subset' + version);
        this.app.ops.recordState(true);
        
        // Add additional information for subsets
        this.app.tooltip.attach('#choose_l' + this.name + '_lSubset' + version + ' a', function(d) {
            var subset;
            if(d > 0 && d <= subsets_arr.length) { // Regular subset
                subset = subsets_arr[d - 1];
                subset = JSON.parse(JSON.stringify(subset));
            } else if (d == 0) { // None option
                return {Name: 'None'};
            } else { // New subset option
                return {Click: ' to make new subsets'}
            }

            ['Tweets', 'Originals', 'Retweets', 'Replies', 'Quotes'].forEach(function(quantity) {
                if(subset['Distinct' + quantity] && subset['Distinct' + quantity] > 0) {
                    subset[quantity + ' <small>(Distinct)</small>'] =
                        util.formatThousands(subset[quantity]) + 
                        ' <small style="left: 200px; position: absolute">(' +
                        util.formatThousands(subset['Distinct' + quantity]) + ')</small>'; 
                } else {
                    subset[quantity + ' <small>(Distinct)</small>'] =
                        util.formatThousands(subset[quantity]); 
                }
                delete subset['Distinct' + quantity];
                delete subset[quantity];
            });
            subset['Datapoints'] = util.formatMinutes(subset['Datapoints']);

            return subset;
        }.bind(this));
        
        triggers.emit('subset' + version + ':set');
    },
    chooseEventType: function() {
        var event_op = this.ops['Event'];
        var curType = this.ops['Event Type'].get();
        var curEvent = event_op.get();
        var firstValid = -1; 
        
        this.events_arr.map(function(event, i) {
            if(event['Type'] == curType || 'All' == curType) {
                d3.select('#Event_' + event['ID'])
                    .style('display', 'block');
                
                if(firstValid == -1)
                    firstValid = i;
            } else {
                d3.select('#Event_' + event['ID'])
                    .style('display', 'none');
                
                if(event['ID'] == curEvent)
                    curEvent = 'invalid';
            }
        });
        
        // If the current collection does not match this type, then make a new one
        if(curEvent == 'invalid') {
            event_op.updateInInterface(firstValid);

            triggers.emit("event:set");
        }
    },
    configureLoadTimeWindow: function() {
        var window = this.ops['Time Window'].get();
        var time_min_op = this.ops['Time Min'];
        var time_max_op = this.ops['Time Max'];
        var time_obj = this.time;
        
        if(window == '1h') {
            time_min_op.date = new Date(time_obj.event_min);
            time_max_op.date = new Date(time_obj.event_min);
            time_max_op.date.setHours(time_max_op.date.getHours() + 1);
        } else if(window == '1d') {
            time_min_op.date = new Date(time_obj.event_min);
            time_max_op.date = new Date(time_obj.event_min);
            time_max_op.date.setHours(time_max_op.date.getHours() + 24);
        } else if(window == '3d') {
            time_min_op.date = new Date(time_obj.event_min);
            time_max_op.date = new Date(time_obj.event_min);
            time_max_op.date.setHours(time_max_op.date.getHours() + 24 * 3);
        } else if(window == '1w') {
            time_min_op.date = new Date(time_obj.event_min);
            time_max_op.date = new Date(time_obj.event_min);
            time_max_op.date.setHours(time_max_op.date.getHours() + 24 * 7);
        } else if(window == 'all') {
            time_min_op.date = new Date(time_obj.event_min);
            time_max_op.date = new Date(time_obj.event_max);
        } else { // Custom
            // TODO Fix problem when this is loaded & it is out of bound
//            time_obj.selected_min = new Date(options.data_time.custom_min);
//            time_obj.selected_max = new Date(options.data_time.custom_max);
        }
        
        // Outer Bounds
        if(time_min_op.date < time_obj.event_min) {
            time_min_op.date = new Date(time_obj.event_min);
        }
        if(time_max_op.date > time_obj.event_max) {
            time_max_op.date = new Date(time_obj.event_max);
        }
        // Inner Bound
        if(time_max_op.date < time_min_op.date) {
            time_max_op.date = new Date(time_min_op.date);
        }
            
        // Set Text Fields
        time_min_op.set(util.formDate(time_min_op.date));
        time_max_op.set(util.formDate(time_max_op.date));
        this.app.ops.recordState(false);
        
        triggers.emit('time_window:updated');
    },
    editLoadTimeWindow: function() {
        var op_time_min = this.ops['Time Min'];
        var op_time_max = this.ops['Time Max'];
        var time_obj = this.time;
        
        op_time_min.custom = new Date(op_time_min.date);
        op_time_max.custom = new Date(op_time_max.date);
        
        // Set Modal Title
        triggers.emit('modal:reset');
        triggers.emit('modal:title', 'Set Time Window');
        
        // Append form
        var modal_body = this.app.modal.body;
        var form = modal_body.append('form')
            .attr({
                id: 'edit_form',
                method: 'post',
                class: 'form-horizontal'
            })
            .on('submit', function() {
                event.preventDefault();
                return false; 
            });
        
        var divs = form.selectAll('div.form-group')
            .data([{
                    label: 'From',
                    time: op_time_min.custom,
                    min: time_obj.event_min,
                    max: time_obj.event_max
                },{
                    label: 'To',
                    time: op_time_max.custom,
                    min: time_obj.event_min,
                    max: time_obj.event_max
                }])
            .enter()
            .append('div')
            .attr('class', 'form-group');
        
        divs.append('label')
            .attr('for', d => 'edit_load_time_' + d.label)
            .attr('class', 'col-sm-3 control-label')
            .text(function(d) { return d.label });
        
        var entries = divs.append('div')
            .attr('class', 'col-sm-9 edit-box edit-box-date input-group')
            .style('width', '1px');
        
        entries.append('div')
            .attr('class', 'input-group-btn')
            .append('button')
            .attr('class', 'btn btn-default')
            .html('<span class="glyphicon glyphicon-step-backward"></span>')
            .on('click', function(d) {
                var ops_dataset = this.ops;
                if(d.label == 'From') {
                    ops_dataset['Time Min'].custom = new Date(this.time.event_min);
                    document.getElementById('edit_load_time_' + d.label).value = util.formDate(ops_dataset['Time Min'].custom);
                } else { // To
                    ops_dataset['Time Max'].custom = new Date(ops_dataset['Time Min'].custom);
                    document.getElementById('edit_load_time_' + d.label).value = util.formDate(ops_dataset['Time Max'].custom);
                }
            }.bind(this));
        
        entries.append('input')
            .attr({
                class: 'form-control',
                type: 'datetime-local',
                id: d => 'edit_load_time_' + d.label,
                value: d => util.formDate(d.time),
                min: d => util.formDate(d.min),
                max: d => util.formDate(d.max)
            })
            .on('change', function(d) {
                var ops_dataset = this.ops;
                var date = new Date(document.getElementById('edit_load_time_' + d.label).value);
                date.setHours(date.getHours() + 8);
                if(d.label == 'From') {
                    ops_dataset['Time Min'].custom = date;
                } else { // To
                    ops_dataset['Time Max'].custom = date;
                }
            }.bind(this));
        
        entries.append('div')
            .attr('class', 'input-group-btn')
            .append('button')
            .attr('class', 'btn btn-default')
            .html('<span class="glyphicon glyphicon-step-forward"></span>')
            .on('click', function(d) {
                var ops_dataset = this.ops;
                if(d.label == 'From') {
                    ops_dataset['Time Min'].custom = new Date(ops_dataset['Time Max'].custom);
                    document.getElementById('edit_load_time_' + d.label).value = util.formDate(ops_dataset['Time Min'].custom);
                } else { // To
                    ops_dataset['Time Max'].custom = new Date(this.time.event_max);
                    document.getElementById('edit_load_time_' + d.label).value = util.formDate(ops_dataset['Time Max'].custom);
                }
            }.bind(this));
        
        // Accept Button
        var ops = this.app.modal.options;
        ops.selectAll('*').remove();
        
        ops.append('button')
            .attr({
//                id: 'edit-window-tweetin',
                class: 'btn btn-primary edit-window-routine'
            })
            .on('click', function(d) {
                var ops_dataset = this.ops;
                // Set values
                ops_dataset['Time Window'].set('custom');
                ops_dataset['Time Min'].date = ops_dataset['Time Min'].custom;
                ops_dataset['Time Max'].date = ops_dataset['Time Max'].custom;
                
                // Close modal
                $('#modal').modal(false);
                
                // Functions
                triggers.emit('time_window:updated');
            }.bind(this))
            .text('Update');
        
        triggers.emit('modal:open');
    },
    editWindow: function(state, collection_type) {
        // Save an object about the editing status
        this.editing = {
            state: state,
            collection_type: collection_type,
            fields: [],
            collection_object: undefined
        };
        // They the object that we are editing, otherwise make a new one
        var collection_object = this[collection_type];
        
        if(state == 'new') {
            collection_object = util.copyObject(this.blank_collection[collection_type]);
            if(collection_type == '') {
                collection_object.ID = d3.min(SR.events_arr, d => d.ID) - 1;
            } else {
                collection_object.ID = d3.max(SR.subsets_arr, d => d.ID) + 1;
            }
        } else if(!collection_object || !('ID' in collection_object)) {
            triggers.emit('alert', 'No information');
            return;
        } /*else if(collection_type == 'subset') {
            triggers.emit('alert', 'Sorry I\' still working on editing subsets');
            return;
        }*/
        this.editing.collection_object = collection_object;
        
        // Set modal
        var modal = this.app.modal;
        triggers.emit('modal:reset');
        triggers.emit('modal:title', '<small>Configure ' + collection_type + ':</small> ' + (collection_object.Label));
        
        // Append form
        var form = modal.body.append('form')
            .attr({
                id: 'edit_form',
                method: 'post',
                class: 'form-horizontal'
            })
            .on('submit', function() {
                event.preventDefault();
                return false; 
            });
        
        // Gather fields
        this.editing.fields = this.collection_fields[collection_type].map(field => {
            return {
                label: field.label,
                name: field.name,
                value: collection_object[field.name],
                type: field.type,
                final: field.final && !(state == 'new' && field.new_editable),
                list: field.list == undefined ? null :
                    typeof(field.list) == 'function' ? field.list() : field.list
            };
        });
        
        var field_divs = form.selectAll('div.form-group.newv')
            .data(this.editing.fields)
            .enter()
            .append('div')
            .attr('class', 'form-group newv');
        
        field_divs.append('label')
            .attr('for', d => 'collection_edit_' + d.name)
            .attr('class', 'col-sm-3 control-label')
            .text(d => d.label);
        
        field_divs.append('div')
            .attr('class', d => 'col-sm-9 edit-box edit-box-' + d.type)
            .append('input')
            .attr({
                class: d => 'form-control' + (d.type == 'Enum' ? ' typeahead' : ''),
                type: d => d.type == 'Date' ? 'datetime-local' : 'text',
                id: d => 'collection_edit_' + d.name,
                name: d => d.name,
                value: d => d.type == 'Date' && d.value ? ((d.value instanceof Date) ?
                    util.formatDate(d.value) : d.value).replace(' ', 'T') :
                    d.value,
                readonly: d => d.final ? true : null,
                'data-provide': d => d.type == 'List' ? 'typeahead' : null
            });
        
        // Convert textarea inputs to textareas;
        var textareas = field_divs.selectAll('.edit-box-Textarea');
        textareas.selectAll('input').remove();
        textareas.append('textarea')
            .attr({
                class: 'form-control',
                type: d => d.type == 'Date' ? 'datetime-local' : 'text',
                id: d => 'collection_edit_' + d.name,
                name: d => d.name,
                placeholder: d => d.value,
                value: d => d.value,
                readonly: d => d.final ? true : null
            })
            .text(d => d.value);
        
        // Add enumerated options for appropriate fields
        this.editing.fields.forEach(this.editWindowConfigureEnum.bind(this));
        
//        if(keys.includes('Query'))
//            this.queryEditCreate(form, collection_object);
        
        form.append('input')
            .attr({
                name: 'type',
                value: collection_type,
                class: 'hidden'
            });
        
        // Add Lower Buttons
        modal.options.append('div')
            .append('button')
            .attr({
                id: 'edit-window-save',
                class: 'btn btn-default'
            })
            .text(state == 'new' ? 'Create ' + collection_type : 'Update')
            .on('click', triggers.emitter('edit collection:update'));
        
//        if(collection_type == 'rumor') {
//            this.editWindowRumorOptions(modal);
//        }
        
        form.selectAll('input')
            .on('input', triggers.emitter('edit collection:changed'));
        
        triggers.emit('modal:open');
    },
    editWindowRumorOptions: function(modal) {
        // TODO fix
        var option = 'rumor';
        
        var tweet_count = modal.options.append('div')
            .attr('id', 'edit-window-tweetin-div')
            .attr('class', 'input-group')
            .style('display', 'inline-table');
            
        tweet_count.append('span')
            .attr('class', 'input-group-addon')
            .text('Count:')
            .style('width', 'auto');

        tweet_count.append('input')
            .attr('id', 'edit-window-tweetin-count')
            .attr('class', 'text-center form-control')
            .attr('readonly', '')
            .style('width', '80px')
            .attr('value', 0);
        
        data.getRumorCount();

        tweet_count.append('div')
            .attr('class', 'input-group-btn')
            .style('margin', '0px')
            .append('button')
            .data([option])
            .attr({
                id: 'edit-window-tweetin',
                class: 'btn btn-primary edit-window-routine'
            })
            .on('click', data.genTweetInCollection)
            .append('span')
            .attr('class', 'glyphicon glyphicon-refresh');
        
        modal.options.append('div')
            .attr('id', 'edit-window-gencount-div')
            .append('button')
            .data([option])
            .attr({
                id: 'edit-window-gencount',
                class: 'btn btn-primary edit-window-routine'
            })
            .on('click', data.rmTweetCount)
            .text('Count Tweets');
//            .append('span')
//            .attr('class', 'glyphicon glyphicon-signal');
        
//        modal.options.append('div')
//            .attr('id', 'edit-window-gencodecount-div')
//            .append('button')
//            .data([option])
//            .attr({
//                id: 'edit-window-gencodecount',
//                class: 'btn btn-primary edit-window-routine'
//            })
//            .on('click', data.rmCodeCount)
//            .text('Count Codes');
//            .append('span')
//            .attr('class', 'glyphicon glyphicon-signal');

        modal.options.append('div')
            .attr('id', 'edit-window-fetch100-div')
            .append('button')
            .data([option + " 100"])
            .attr({
                id: 'edit-window-fetch100',
                class: 'btn btn-primary edit-window-routine'
            })
            .on('click', function() {
                data.getTweets({
                    limit: 300,
                    distinct: 1,
                    rand: '',
                    rumor_id: data.rumor.ID,
                    csv: ''
                });
            })
            .html('<span class="glyphicon glyphicon-download-alt"></span> 100 Rand');

        modal.options.append('div')
            .attr('id', 'edit-window-fetchall-div')
            .append('button')
            .data([option + " all"])
            .attr({
                id: 'edit-window-fetchall',
                class: 'btn btn-primary edit-window-routine'
            })
            .on('click', function() {
                data.getTweets({
                    limit: 10000,
                    distinct: 1,
                    rumor_id: data.rumor.ID,
                    csv: ''
                });
            })
            .html('<span class="glyphicon glyphicon-download-alt"></span> All');
    },
    editWindowChanged: function(field) {
        if(this.editing.collection_type == 'subset' && ['Event', 'Rumor'].includes(field.label)) {
            console.log('Editing Event, should update rumors & subsets');
            var event_id = document.getElementById('collection_edit_Event').value;
            var rumor_id = document.getElementById('collection_edit_Rumor').value;
            var event = event_id ? SR.events[event_id] : SR;
            var addRumorLabelToSubsetName = event_id != "" && rumor_id == "";
            var subset_list = event_id == "" ? SR.subsets_arr :
                              rumor_id != "" ? event.rumors[rumor_id].subsets_arr : event.subsets_arr;
            
            if(field.label == 'Event') {
                // Change the rumor list to JUST be for this event
                var rumor_field = this.editing.fields.filter(d => d.label == 'Rumor')[0];
                var rumor_list = event.rumors_arr.map(d => { 
                    return {label: d.Label + ' (' + d.ID + ')', value: d.ID};
                });
                rumor_field.list = rumor_list;
                $('#collection_edit_' + rumor_field.name).typeahead('destroy');
                this.editWindowConfigureEnum(rumor_field);
            }
            
            // Change the superset list to JUST be for this event (and rumor)
            var superset_field = this.editing.fields.filter(d => d.label == 'Superset')[0];
            var superset_list = subset_list.map(function(d) { 
                return {
                    label: (addRumorLabelToSubsetName ? "<small><em>" + d.Rumor.Label + "</em></small> " : "") +
                           d.FeatureMatch + ' (' + d.ID + ')',
                    value: d.ID
                };
            });
            superset_field.list = superset_list;
            $('#collection_edit_' + superset_field.name).typeahead('destroy');
            this.editWindowConfigureEnum(superset_field);
        }
        
        // Indicate that the collection is to be updated
        d3.select('#edit-window-save')
            .attr('class', 'btn btn-primary');

        // Disable Match/Fetch buttons
        d3.selectAll('.edit-window-routine')
            .attr('disabled', '');
    },
    editWindowConfigureEnum: function(field) {
        if(field.name == 'rumor')
            console.log(field);
        if(field.type == 'Enum') {
            var bh_choices = new Bloodhound({
                datumTokenizer: d => d.label.split(/[\W_]+/g),
                queryTokenizer: d => d.split(/[\W_]+/g),
                local: field.list,
            });

            bh_choices.initialize();

            // Initialize Autocompleting Input
            $('#collection_edit_' + field.name).typeahead({
                hint: false,
                highlight: true,
                minLength: 0
            }, {
                name: 'collection_edit_' + field.name,
                limit: 100,
                display: 'value',
                source: (q, sync) => q === '' ? 
                    sync(bh_choices.all()) :
                    bh_choices.search(q, sync),
                matcher: item => this.query == '' || item.indexOf(this.query) >= 0,
                templates: {
                    empty: '<div class="tt-suggestion"><em>No Match</em></div>',
                    suggestion: function(d) {
                        return '<div class="tt-suggestion">' + d.label + '</div>'; 
                    }
                }
            });

            // Add happening on select
            $('#collection_edit_' + field.name).bind('typeahead:selected', function(ev, suggestion) {
                // Mark it as changed
                triggers.emit('edit collection:changed', field);
            }.bind(this));
        }
    }
};