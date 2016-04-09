function StatusReport() {
    this.connection = new Connection();
    this.ops = new Options(this);
    this.dataset = new CollectionManager(this, {name: 'dataset', flag_sidebar: false});
    this.tooltip = new Tooltip();
    this.modal = new Modal();
    
    this.events = {};
    this.events_arr = [];
    this.subsets = {};
    this.subsets_arr = [];
    this.event_types = {};
    this.event_types_arr = [];
    
    this.quantities = ['Tweets', 'DistinctTweets', 
                       'Originals', 'DistinctOriginals', 'Retweets', 'DistinctRetweets', 
                       'Replies', 'DistinctReplies', 'Quotes', 'DistinctQuotes', 
                       'FirstTweet', 'LastTweet', 'Datapoints'];
}
StatusReport.prototype = {
    init: function() {
        this.setTriggers();
        this.getData();
        this.tooltip.init();
    },
    setTriggers: function() {
        triggers.on('sort_elements', function() { this.clickSort(false, 'maintain_direction'); }.bind(this));
        triggers.on('new_counts', this.computeAggregates.bind(this));
        triggers.on('update_counts', this.updateTableCounts.bind(this));
        triggers.on('refresh_visibility', this.setVisibility.bind(this));
    },
    getData: function() {
        var datasets = 2;
            
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
        this.subsets = {};
        this.event_types = {};
        this.event_types_arr = [];
        this.featuresets_arr = [];
        
        // Link all of the data
        this.events_arr.forEach(function(event) {
            // Add fields
            event.ID = parseInt(event.ID);
            event.Label = event.DisplayName || event.Name;
            event.Level = 1;
            this.quantities.forEach(function (quantity) {
                event[quantity] = parseInt(event[quantity]) || 0;
            });
            
            // Add to event type list (or make new event type list)
            var type = event.Type;
            if(type in this.event_types) {
                this.event_types[type].events.push(event);
            } else {
                var new_event_type = {
                    Level: 0,
                    Label: type,
                    events: [event]
                }
                this.event_types[type] = new_event_type;
                this.event_types_arr.push(new_event_type);
            }
            event['Event Type'] = this.event_types[type];
            event['Event'] = event; // weird but makes things easier
            
            event.featuresets = {};
            event.featuresets_arr = [];
            
            // Add to indiced object
            this.events[event.ID] = event;
        }, this);
        
        this.subsets_arr.forEach(function(subset) {
            // Add fields
            subset.ID = parseInt(subset.ID);
            subset.Label = subset.Match.replace(/\\W/g, '<span style="color:#ccc">_</span>');
            subset.Level = 3;
            this.quantities.forEach(function (quantity) {
                subset[quantity] = parseInt(subset[quantity]) || 0;
            });
            
            // Add direct subset to Event
            subset.Event_ID = subset.Event;
            var event = this.events[subset.Event_ID];
            if(event.subsets) {
                event.subsets.push(subset);
            } else {
                event.subsets = [subset];
            }
            subset.Event = event;
            
            // Add to higher event type
            subset['Event Type'] = event['Event Type'];
            
            // Add to event's featuresets
            if(subset.Feature in event.featuresets) {
                event.featuresets[subset.Feature].subsets.push(subset);
            } else {
                var new_feature_set = {
                    Level: 2,
                    Label: subset.Feature,
                    Event: event,
                    'Event Type': event['Event Type'],
                    subsets: [subset]
                }
                new_feature_set['Feature Set'] = new_feature_set;
                event.featuresets[subset.Feature] = new_feature_set;
                event.featuresets_arr.push(new_feature_set);
                this.featuresets_arr.push(new_feature_set);
                
            }
            subset['Feature Set'] = event.featuresets[subset.Feature];
            
            // Add to indiced object
            this.subsets[subset.ID] = subset;
        }, this);
        
        // Add children columns
        this.event_types_arr.sort(function(a, b) {
            if (a.Label < b.Label) return -1;
            if (a.Label > b.Label) return 1;
            return 0;
        });
        this.event_types_arr.forEach(function(d, i) {
            d.ID = i;
            d.children = d.events;
        });
        
        this.events_arr.forEach(function(e) {
            e.children = e.featuresets_arr;
            
            e.featuresets_arr.sort(function(a, b) {
                if (a.Label < b.Label) return -1;
                if (a.Label > b.Label) return 1;
                return 0;
            });
            e.featuresets_arr.forEach(function(d, i) {
                d.ID = d.Event.ID * 100 + i;
                d.children = d.subsets;
            });
        });
        
        this.buildOptions();
    },
    computeAggregates: function() {
        this.events_arr.forEach(function(e) {
//            e.children = e.subsets;
            e.children = e.featuresets_arr;
            
//            e.featuresets_arr.forEach(function(d) {
//                d.children = d.subsets;
//            });
            
//            e.Tweets         = e.Tweets         || d3.sum(e.rumors, function(r) { return r.Tweets         || 0; });
//            e.DistinctTweets = e.DistinctTweets || d3.sum(e.rumors, function(r) { return r.DistinctTweets || 0; });
//            e.CodedTweets    = e.CodedTweets    || d3.sum(e.rumors, function(r) { return r.CodedTweets    || 0; });
//            e.AdjudTweets    = e.AdjudTweets    || d3.sum(e.rumors, function(r) { return r.AdjudTweets    || 0; });
//            e.Datapoints     = e.Datapoints     || d3.sum(e.rumors, function(r) { return r.Datapoints     || 0; });
        });
        
        this.featuresets_arr.forEach(function(d) {
            d.children = d.subsets;
            
            ['Tweets', 'DistinctTweets', 
              'Originals', 'DistinctOriginals', 'Retweets', 'DistinctRetweets', 
              'Replies', 'DistinctReplies', 'Quotes', 'DistinctQuotes', 'Datapoints'].forEach(function(count) {
                d[count] = d3.sum(d.children, function(e) { return e[count] || 0; });
            });
            
//            d.CodedTweets       = d3.sum(d.events, function(e) { return e.CodedTweets    || 0; });
//            d.AdjudTweets       = d3.sum(d.events, function(e) { return e.AdjudTweets    || 0; });
            d.FirstTweet_Min    = d3.min(d.children, function(e) { return e.FirstTweet        || 1e20; });
            d.FirstTweet_Max    = d3.max(d.children, function(e) { return e.FirstTweet        || 0; });
            d.LastTweet_Min     = d3.min(d.children, function(e) { return e.LastTweet         || 1e20; });
            d.LastTweet_Max     = d3.max(d.children, function(e) { return e.LastTweet         || 0; });
            
            d.FirstTweet        = d.FirstTweet_Min;
            d.LastTweet         = d.LastTweet_Max;
            d.ID_Min            = d3.min(d.children, function(e) { return parseInt(e.ID)      || 0; });
            d.ID_Max            = d3.max(d.children, function(e) { return parseInt(e.ID)      || 0; });
            
            // Self
            d['Feature Set'] = d;
        });
        
        this.event_types_arr.forEach(function(d) {
            d.children = d.events;
            
            ['Tweets', 'DistinctTweets', 
              'Originals', 'DistinctOriginals', 'Retweets', 'DistinctRetweets', 
              'Replies', 'DistinctReplies', 'Quotes', 'DistinctQuotes', 'Datapoints'].forEach(function(count) {
                d[count] = d3.sum(d.events, function(e) { return e[count] || 0; });
            });
            
//            d.CodedTweets       = d3.sum(d.events, function(e) { return e.CodedTweets    || 0; });
//            d.AdjudTweets       = d3.sum(d.events, function(e) { return e.AdjudTweets    || 0; });
            d.FirstTweet_Min    = d3.min(d.events, function(e) { return e.FirstTweet        || 1e20; });
            d.FirstTweet_Max    = d3.max(d.events, function(e) { return e.FirstTweet        || 0; });
            d.LastTweet_Min     = d3.min(d.events, function(e) { return e.LastTweet         || 1e20; });
            d.LastTweet_Max     = d3.max(d.events, function(e) { return e.LastTweet         || 0; });
            
            d.FirstTweet        = d.FirstTweet_Min;
            d.LastTweet         = d.LastTweet_Max;
            d.ID_Min            = d3.min(d.events, function(e) { return parseInt(e.ID)      || 0; });
            d.ID_Max            = d3.max(d.events, function(e) { return parseInt(e.ID)      || 0; });
            
            // Self
            d['Event Type'] = d;
        });
        
        triggers.emit('update_counts');
    },
    buildOptions: function() {
        this.ops.updateCollectionCallback = this.getData;
        
        var orders = ['ID', 'Collection', 'Tweets', 
                      'Originals', 'Retweets', 'Replies', 'Quotes', 
                      'First Tweet', 'Last Tweet', 'Datapoints'];
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
                labels: ['-', 'Event', 'Event\'s Types', 'Feature', 'Match', 'Distinct/Not'],
                ids:    ['raw', 'event', 'type', 'feature', 'match', 'distinct'],
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
            'Datapoints Format': new Option({
                title: 'Datapoints',
                labels: ['Count', 'Minutes'],
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
        
        //status....
        this.buildTable();
    },
    buildTable: function() {
        var columns = ['ID', 'Collection',
                       'Tweets', 'Originals', 'Retweets', 'Replies', 'Quotes', 
                       'First Tweet', 'Last Tweet', 'Datapoints', 
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
                .attr('class', 'row_type');
            
            event_type.events.forEach(function(event) {
                event.row = table_body.append('tr')
                    .data([event])
                    .attr('class', function(d) { return 'row_event row_event_' + d.ID; });
                
                event.featuresets_arr.forEach(function(featureset) {
                    featureset.row = table_body.append('tr')
                        .data([featureset])
                        .attr('class', function(d) { return 'row_feature'; });
                    
                    featureset.subsets.forEach(function(subset) {
                        subset.row = table_body.append('tr')
                            .data([subset])
                            .attr('class', function(d) { return 'row_subset row_subset_' + d.ID; });
                    });
                });
            });
        })
        
        // ID & Label
        table_body.selectAll('tr')
            .append('td')
            .html(function(d) { return d.Level % 2 == 1 ? d.ID : ''; })
        
        table_body.selectAll('tr')
            .append('td')
            .append('div')
            .attr('class', 'cell-label')
            .append('span')
            .attr('class', 'value')
            .html(function(d) { return d.Label; });
        
        table_body.selectAll('.row_feature .cell-label, .row_event .cell-label, .row_type .cell-label')
            .on('click', this.setVisibility_children.bind(this))
            .append('small')
            .attr('class', 'glyphicon-hiddenclick')
            .html(function(d) { 
                return d.children.length + ' ' + 
                    (d.Level == 0 ? 'events' : (d.Level == 1 ? 'features' : 'matches')); 
            });
        
        
        this.tooltip.attach('.cell-label', function(set) {
            if(set['Level'] == 0) {
                return {
                    ID: set['ID'],
                    'Event Type': set['Label'],
                    Events: set['events'] ? set['events'].map(function(event) { return event['Label']; }) : null
                }
            } else if(set['Level'] == 1) {
                return {
                    ID: set['ID'],
                    Event: set['Label'],
                    'Event Type': set['Event Type']['Label']
                }
            } else if(set['Level'] == 2) {
                return {
                    ID: set['ID'],
                    Feature: set['Label'],
                    Event: set['Event']['Label'],
                    'Event Type': set['Event Type']['Label']
                }
            } else {
                return {
                    ID: set['ID'],
                    Match: set['Match'],
                    Feature: set['Feature'],
                    Event: set['Event']['Label'],
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
                var feature = set['Feature Set'] || set;
                info[type] = util.formatThousands(value);
                if(set.Level >= 2 || type != 'Tweets') {
                    info['% of Event'] = (value / event['Tweets'] * 100).toFixed(1) + '%';
                }
                if(set.Level >= 2 && type != 'Tweets') {
                    info['% of Type'] = (value / event[type] * 100).toFixed(1) + '%';
                    info['% of Feature'] = (value / feature['Tweets'] * 100).toFixed(1) + '%';
                    if(set.Level >= 3) {
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
                    info['% D of Feature'] = (value / feature['Tweets'] * 100).toFixed(1) + '%';
                    if(set.Level >= 3) {
                        info['% D of Subset'] = (value / set['Tweets'] * 100).toFixed(1) + '%';
                    }
                }

                return info;
            });
        }, this);
        
        // Append the recalculate button
        table_body.selectAll('.row_type .cell-Tweets, .row_feature .cell-Tweets').append('span') // hidden one to help alignment
            .attr('class', 'glyphicon glyphicon-refresh glyphicon-hidden');
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
        
        var datapoint_cells = table_body.selectAll('tr')
            .append('td')
            .append('div')
            .attr('class', 'cell-datapoints cell-count');
        datapoint_cells.append('span').attr('class', 'value');
        
        table_body.selectAll('.row_type .cell-datapoints, .row_feature .cell-datapoints').append('span') // hidden one to help alignment
            .attr('class', 'glyphicon glyphicon-refresh glyphicon-hidden');
        table_body.selectAll('.row_event .cell-datapoints, .row_subset .cell-datapoints').append('span')
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

        table_body.selectAll('.row_event .cell_options')
            .append('span')
            .attr('class', 'glyphicon glyphicon-signal glyphicon-hoverclick')
            .style('margin-left', '5px')
            .on('click', this.openTimeseries);
        
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
//        d.row.select('.cell-label .glyphicon')
//            .classed('glyphicon-chevron-left', show_children)
//            .classed('glyphicon-chevron-down', !show_children);
        
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
        var table_body = d3.select(selector);
        var distinct = this.ops['Columns']['Distinct'].get();
        var relative = this.ops['Columns']['Relative'].get();
        var date_format = this.ops['Columns']['Date Format'].get();
        var datapoints_format = this.ops['Columns']['Datapoints Format'].get();
        
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
                                relative == 'feature'  ? (d['Level'] >= 3 ? d['Feature Set'][quantity] : d[quantity]): 
                                relative == 'subset'   ? d['Tweets'] : 
                                relative == 'distinct' ? d[type] : 1;
                    d[type + 'Display'] = value / denom;
                    return (value / denom * 100).toFixed(1);
                });
        });
        
        // Set visibility of zero/non-zero rows
        table_body.selectAll('tr')
            .classed('row-zero', function(d) { return !(d.Tweets || d.Datapoints || d.CodedTweets) ; });
        
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
        
        // Datapoints
        table_body.selectAll(".cell-datapoints .value")
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
                var interpol = d3.interpolate(start || 0, d.Datapoints || 0);

                return function (value) {
                    if(typeof(value) == 'string') {
                        if(value.includes('m')) {
                            value = util.deformatMinutes(value);
                        } else {
                            value = parseInt(value.replace(/ /g, ''));
                        }
                    }
                    value = Math.round(interpol(value));
                    if(datapoints_format == 'minutes') {
                        this.textContent = util.formatMinutes(value);
                    } else {
                        this.textContent = util.formatThousands(value);
                    }
                };
            });
        
        triggers.emit('refresh_visibility');
    },
    edit: function(d) {
        if(d.Level == 1) { // Event
            this.dataset.event = d;
            triggers.emit('edit_window:open', 'event');
        } else if(d.Level == 3) { // Subset
            this.dataset.subset = d;
            triggers.emit('edit_window:open', 'subset');
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
                
                // Compare Event Types
                var A = a['Event Type'][quantity];
                var B = b['Event Type'][quantity];
//                if(lA == 0 && lB == 0 && !A && !B) return 0;
                if(!A) return  1;
                if(!B) return -1;
                if(A < B) return -1 * ascending_bin;
                if(A > B) return  1 * ascending_bin;
                if(lA == 0 && lB == 0) return  a['ID_Min'] - b['ID_Min'];
                if(lA == 0 && lB >  0) return -1;
                if(lA >  0 && lB == 0) return  1;
                
                // Compare Events
                A = a['Event'][quantity];
                B = b['Event'][quantity];
//                if(lA == 1 && lB == 1 && !A && !B) return 0;
                if(!A) return  1;
                if(!B) return -1;
                if(A < B) return -1 * ascending_bin;
                if(A > B) return  1 * ascending_bin;
                if(lA == 1 && lB == 1) return  a['ID'] - b['ID'];
                if(lA == 1 && lB >  1) return -1;
                if(lA >  1 && lB == 1) return  1;
                
                // Compare Feature Sets
                A = a['Feature Set'][quantity];
                B = b['Feature Set'][quantity];
//                if(lA == 2 && lB == 2 && !A && !B) return 0;
                if(!A) return  1;
                if(!B) return -1;
                if(A < B) return -1 * ascending_bin;
                if(A > B) return  1 * ascending_bin;
                if(lA == 2 && lB == 2) return  a['ID'] - b['ID'];
                if(lA == 2 && lB >  2) return -1;
                if(lA >  2 && lB == 2) return  1;
                
                // Compare Subsets
                A = a[quantity];
                B = b[quantity];
//                if(lA == 2 && lB == 2 && !A && !B) return 0;
                if(!A) return  1;
                if(!B) return -1;
                if(A < B) return -1 * ascending_bin;
                if(A > B) return  1 * ascending_bin;
                
                if(lA == lB) return  a['ID'] - b['ID'];
                if(lA <  lB) return  1;
                if(lA >  lB) return -1;

                return 0;
            });
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
            ID: d.ID
        }
        var row = '.row_' + (d.Level == 1 ? 'event' : 'subset') + '_' + d.ID;
        
        // Start loading sign
        var prog_bar = new Progress({
            'initial': 100,
            'parent_id': row + ' .cell-Tweets',
            full: true, 
            text: ' '
        });
        prog_bar.start();
        
        // Start the recount
        this.connection.php('collection/recount', post, function(result) {
            if(result.includes('Error')) {
                prog_bar.update(100, 'Error');
                console.error(result);
                return;
            }
            
            // Update values
            try {
                result = JSON.parse(result)[0];
            } catch (exception) {
                prog_bar.update(100, 'Error');
                console.error(result);
                return;
            }
            
            this.quantities.forEach(function (quantity) {
                d[quantity] = parseInt(result[quantity]) || 0;
            });
            
            triggers.emit('update_counts', row);

            // Remove loading sign
            prog_bar.end();
        }.bind(this));
    },
    computeTimeseries: function(d) {
        var row = '.row_' + (d.Level == 1 ? 'event' : 'subset') + '_' + d.ID;
        var args = {
            url: 'timeseries/compute',
            post: {
                Collection: d.Level == 1 ? 'event' : 'subset',
                ID: d.ID
            },
            tweet_min: d.FirstTweet,
            tweet_max: d.LastTweet,
            progress_div: row + ' .cell-datapoints',
            progress_text: ' ',
            progress_full: true,
            on_chunk_finish: function(result) {
                if(result.includes('Error')) {
//                    this.progress.update(100, 'Error');
                    console.error(result);
                    return;
                }

                // Update values
                try {
                    result = JSON.parse(result)[0];
                } catch (exception) {
                    console.error(result);
                    return;
                }
                
                d['Datapoints'] = parseInt(result['Datapoints']);
                
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
    }
};

function initialize() {
    SR = new StatusReport();
    
    SR.init();
}
window.onload = initialize;