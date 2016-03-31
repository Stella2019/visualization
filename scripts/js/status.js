function StatusReport() {
    this.connection = new Connection();
    this.ops = new Options(this);
    this.tooltip = new Tooltip;
    
    this.events = {};
    this.events_arr = [];
    this.subsets = {};
    this.subsets_arr = [];
    this.event_types = {};
    this.event_types_arr = [];
}
StatusReport.prototype = {
    init: function() {
        this.setTriggers();
        this.getData();
        this.tooltip.init();
    },
    setTriggers: function() {
        triggers.on('sort_elements', function() { this.clickSort(false, 'maintain_direction'); }.bind(this));
        triggers.on('update_all_counts', this.updateTableCounts.bind(this));
    },
    getData: function() {
        var datasets = 2;
            
        this.connection.php('collection/getEvent', {}, function(d) {
            try {
                this.events_arr = JSON.parse(d);
            } catch(err) {
                console.log(d);
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
                console.log(d);
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
        var quantities = ['Tweets', 'DistinctTweets', 
                      'Originals', 'DistinctOriginals', 'Retweets', 'DistinctRetweets', 
                      'Replies', 'DistinctReplies', 'Quotes', 'DistinctQuotes', 
                      'FirstTweet', 'LastTweet'];
        
        // Link all of the data
        this.events_arr.forEach(function(event) {
            // Add fields
            event.ID = parseInt(event.ID);
            event.subsets = [];
            event.Label = event.DisplayName || event.Name;
            event.Level = 1;
            quantities.forEach(function (quantity) {
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
            
            
            // Add to indiced object
            this.events[event.ID] = event;
        }, this);
        this.subsets_arr.forEach(function(subset) {
            // Add fields
            subset.ID = parseInt(subset.ID);
            subset.Label = subset.Feature + ": " + subset.Match.replace(/\\W/g, '<span style="color:#ccc">_</span>');
            subset.Level = 2;
            subset.Event_ID = subset.Event;
            quantities.forEach(function (quantity) {
                subset[quantity] = parseInt(subset[quantity]) || 0;
            });
            
            subset.Event = this.events[subset.Event_ID];
            if(subset.Event.subsets) {
                subset.Event.subsets.push(subset);
            } else {
                subset.Event.subsets = [subset];
            }
            subset['Event Type'] = subset.Event['Event Type'];
            
            // Add to indiced object
            this.subsets[subset.ID] = subset;
        }, this);
        
        this.buildDropdowns();
    },
    computeAggregates: function() {
//        this.events_arr.forEach(function(e) {
//            e.Tweets         = e.Tweets         || d3.sum(e.rumors, function(r) { return r.Tweets         || 0; });
//            e.DistinctTweets = e.DistinctTweets || d3.sum(e.rumors, function(r) { return r.DistinctTweets || 0; });
//            e.CodedTweets    = e.CodedTweets    || d3.sum(e.rumors, function(r) { return r.CodedTweets    || 0; });
//            e.AdjudTweets    = e.AdjudTweets    || d3.sum(e.rumors, function(r) { return r.AdjudTweets    || 0; });
//            e.Datapoints     = e.Datapoints     || d3.sum(e.rumors, function(r) { return r.Datapoints     || 0; });
//        });
        
        this.event_types_arr.forEach(function(d) {
            d.Tweets            = d3.sum(d.events, function(e) { return e.Tweets            || 0; });
            d.DistinctTweets    = d3.sum(d.events, function(e) { return e.DistinctTweets    || 0; });
            d.Originals         = d3.sum(d.events, function(e) { return e.Originals         || 0; });
            d.DistinctOriginals = d3.sum(d.events, function(e) { return e.DistinctOriginals || 0; });
            d.Retweets          = d3.sum(d.events, function(e) { return e.Retweets          || 0; });
            d.DistinctRetweets  = d3.sum(d.events, function(e) { return e.DistinctRetweets  || 0; });
            d.Replies           = d3.sum(d.events, function(e) { return e.Replies           || 0; });
            d.DistinctReplies   = d3.sum(d.events, function(e) { return e.DistinctReplies   || 0; });
            d.Quotes            = d3.sum(d.events, function(e) { return e.Quotes            || 0; });
            d.DistinctQuotes    = d3.sum(d.events, function(e) { return e.DistinctQuotes    || 0; });
//            d.CodedTweets       = d3.sum(d.events, function(e) { return e.CodedTweets    || 0; });
//            d.AdjudTweets       = d3.sum(d.events, function(e) { return e.AdjudTweets    || 0; });
//            d.Datapoints        = d3.sum(d.events, function(e) { return e.Datapoints     || 0; });
            d.FirstTweet_Min    = d3.min(d.events, function(e) { return e.FirstTweet        || 0; });
            d.FirstTweet_Max    = d3.max(d.events, function(e) { return e.FirstTweet        || 0; });
            d.LastTweet_Min     = d3.min(d.events, function(e) { return e.LastTweet         || 0; });
            d.LastTweet_Max     = d3.max(d.events, function(e) { return e.LastTweet         || 0; });
            d.ID_Min            = d3.min(d.events, function(e) { return parseInt(e.ID)      || 0; });
            d.ID_Max            = d3.max(d.events, function(e) { return parseInt(e.ID)      || 0; });
        });
        
        this.updateTableCounts();
    },
    buildDropdowns: function() {
        this.ops.updateCollectionCallback = this.getData;
        
        var orders = ['ID', 'Collection', 'Tweets', 'Distinct Tweets', 
                      'Originals', 'Retweets', 'Replies', 'Quotes', 
                      'First Tweet', 'Last Tweet'];
        this.ops['View'] = {
            empties: new Option({
                title: 'Show Rows with No Tweets',
                labels: ['Yes', 'No'],
                ids:    ["true", "false"],
                default: 1,
                type: "dropdown",
                callback: this.setVisibility.bind(this)
            }), 
            hierarchical: new Option({
                title: 'Maintain Hierarchy',
                labels: ['Yes', 'No'],
                ids:    ["true", "false"],
                default: 0,
                type: "dropdown",
                callback: triggers.emitter('sort_elements')
            }),
//            levels: new Option({
//                title: 'Show',
//                labels: ['All Levels',
//                         'Event Types & Events',
//                         'Events',
//                         'Events & Rumors',
//                         'Rumors'],
//                ids:    ["all", "etr", "e", "er", "r"],
//                default: 0,
//                type: "dropdown",
//                parent: '#status_table_header',
//                callback: this.buildTable
//            }),
            order: new Option({
                title: 'Order',
                labels: orders,
                ids:    orders,
                default: 0,
                type: "dropdown",
                callback: triggers.emitter('sort_elements')
            }),
            ascending: new Option({
                title: 'Ascending',
                labels: ['Ascending', 'Descending'],
                ids:    ['true', 'false'],
                default: 0,
                type: "dropdown",
                callback: triggers.emitter('sort_elements')
            })
        };
        this.ops['Counts'] = {
            Distinct: new Option({
                title: 'Distinct?',
                labels: ['Show All', 'Only Distinct'],
                ids:    ['', 'Distinct'],
                default: 0,
                type: "dropdown",
                callback: triggers.emitter('update_all_counts')
            }),
            Relative: new Option({
                title: 'Relative to',
                labels: ['-', 'Event', 'Event\'s Types', 'Whole Subset', 'Distinct/Repeat'],
                ids:    ['raw', 'event', 'type', 'subset', 'distinct'],
                default: 0,
                type: "dropdown",
                callback: triggers.emitter('update_all_counts')
            })
        };
        this.ops.panels = ['View', 'Counts'];
        
        // Start drawing
        this.ops.init();
        
        //status....
        this.buildTable();
    },
    buildTable: function() {
        var columns = ['ID', 'Collection',
                       'Tweets', 'Originals', 'Retweets', 'Replies', 'Quotes', 
                       'First Tweet', 'Last Tweet', 
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
            table_body.append('tr')
                .data([event_type])
                .attr('class', 'row_type');
            
            event_type.events.forEach(function(event) {
                table_body.append('tr')
                    .data([event])
                    .attr('class', function(d) { return 'row_event row_event_' + d.ID; });
                
                event.subsets.forEach(function(rumor) {
                    table_body.append('tr')
                        .data([rumor])
                        .attr('class', function(d) { return 'row_subset row_subset_' + d.ID; });
                });
            });
        })
        
        // ID & Label
        table_body.selectAll('tr')
            .append('td')
            .html(function(d) { return d.Level > 0 ? d.ID : ''; })
//            .style('font-weight', function(d) { return d.Level == 1 ? 'bold' : 'normal' });
        
        table_body.selectAll('tr')
            .append('td')
            .html(function(d) { return d.Label; })
//            .style('padding-left', function(d) { return 10 + d.Level * 20 + 'px';})
//            .style('font-weight', function(d) { return d.Level == 1 ? 'bold' : 'normal' })
            .attr('class', 'cell-label');
//            .append('span')
//            .attr('class', 'glyphicon-hiddenclick')
//            .html(function(d) { return d.Level > 0 ? 'ID: ' + d.ID : ''; });
        
        // Counts
        ['Tweets', 'Originals', 'Retweets', 'Replies', 'Quotes'].forEach(function(type) {
            table_body.selectAll('tr')
                .append('td')
                .attr('class', 'cell-' + type + ' cell-count');
        });
        
        // Times
        table_body.selectAll('tr')
            .append('td')
            .attr('class', 'cell-firstdate');
        table_body.selectAll('tr')
            .append('td')
            .attr('class', 'cell-lastdate');
        
        // Buttons
        table_body.selectAll('tr')
            .append('td')
            .attr('class', 'cell_options')
        
        table_body.selectAll('tr.row_event td.cell_options, tr.row_subset td.cell_options')
            .append('span')
            .attr('class', 'glyphicon glyphicon-edit glyphicon-hoverclick')
            .on('click', this.edit);

        table_body.selectAll('tr.row_event td.cell_options')
            .append('span')
            .attr('class', 'glyphicon glyphicon-signal glyphicon-hoverclick')
            .style('margin-left', '5px')
            .on('click', this.openTimeseries);
        
//        table_body.selectAll('tr.row_rumor td.cell_options')
//            .append('span')
////            .attr('class', 'btn btn-xs btn-default')
//            .text('Codes')
//            .attr('class', 'glyphicon-hoverclick')
//            .style('margin-left', '5px')
//            .on('click', this.openCodingReport);
        
        // Set the counts
        triggers.emit('update_all_counts');
    },
    formatThousands: function(value) {
//        var unit = '';
//        if(value > 1e9) {
//            value /= 1e9;
//            unit = ' G';
//        }
//        if(value > 1e6) {
//            value /= 1e6;
//            unit = ' M';
//        }
//        if(value > 1e3) {
//            value /= 1e3;
//            unit = ' K';
//        }
//        return value.toFixed(value < 10 && value > 0 ? 1 : 0) + unit;
        
        var res = '';
        for (var i = Math.floor(Math.log10(value)); i >= 0; i--) {
//            console.log(value, res, value / Math.pow(10, i), i);
            res += Math.floor(value / Math.pow(10, i));
            if(i % 3 == 0)
                res += ' ';
            value = value % Math.pow(10, i);
        }
        return res + '&nbsp;';
    },
    formatMinutes: function(value) {
        var days = Math.floor(value / 60 / 24);
        var hours = Math.floor(value / 60) % 24;
        var minutes = value % 60;
        if(days) return days + 'd ' + (hours < 10 ? '0' : '') + hours + 'h ' + (minutes < 10 ? '0' : '') + minutes + 'm&nbsp;';
        if(hours) return hours + 'h ' + (minutes < 10 ? '0' : '') + minutes + 'm&nbsp;';
        return minutes + 'm&nbsp;';
    },
    setVisibility: function() {
        var table_body = d3.select('tbody');
        
        table_body.selectAll('tr')
            .style('display', 'table-row');
        if(this.ops['View']['empties'].is('false')) {
            d3.selectAll('tr.row-zero')
                .style('display', 'none');
        }
    },
    updateTableCounts: function(selector) {
        selector = selector || 'tbody';
        var table_body = d3.select(selector);
        var distinct = this.ops['Counts']['Distinct'].get();
        var relative = this.ops['Counts']['Relative'].get();
        
        // Update the text of rows with the counts
        
        ['Tweets', 'Originals', 'Retweets', 'Replies', 'Quotes'].forEach(function(type) {
            var quantity = distinct + type;
            table_body.selectAll('td.cell-' + type)
                .html(function(d) {
                    var value = d[quantity];
                    if(!value)
                        return '';
                    if(relative == 'raw')
                        return this.formatThousands(value);
                    var denom = relative == 'event' ? d['Event']['Tweets'] : 
                                relative == 'type' ? d['Event'][quantity] : 
                                relative == 'subset' ? d['Tweets'] : 
                                relative == 'distinct' ? d[type] : -1;
                    return (value / denom * 100).toFixed(1) + '%';
//                    return quantity in d ? this.formatThousands(d[quantity]) : '';
                }.bind(this));
        }, this);
        
        // Append the refresh button
        table_body.selectAll('td.cell-count.cell-Tweets')
            .append('span')
            .attr('class', 'glyphicon glyphicon-refresh glyphicon-hiddenclick')
            .on('click', this.recount.bind(this));
        
        // Set visibility of zero/non-zero rows
        table_body.selectAll('tr')
            .classed('row-zero', function(d) { return !(d.Tweets || d.Datapoints || d.CodedTweets) ; });
        this.setVisibility();  
        
        // Dates
        table_body.selectAll('td.cell-firstdate')
            .html(function(d) { return 'FirstTweet' in d && d.FirstTweet ? d.FirstTweet || '-' : ''; });
        table_body.selectAll('td.cell-lastdate')
            .html(function(d) { return 'LastTweet' in d && d.LastTweet ? d.LastTweet || '-' : ''; });
        
        triggers.emit('sort_elements');
    },
    edit: function(d) {
        if(d.Level == 1) { // Event
            this.app.model = {event: d}
            this.ops.editWindow('collection');
        } else if(d.Level == 2) { // Event
            this.app.model = {subset: d}
            this.ops.editWindow('subset');
        }
    },
    clickSort: function(order, option) {
        var table_body = d3.select('tbody');
        if(!order) order = this.ops['View']['order'].get();
        var header = d3.select('.col-' + util.simplify(order));
        var clicked = header.data()[0];
        var order = this.ops['View']['order'].get();
        var ascending = this.ops['View']['ascending'].get();
        
        if(clicked) {
            d3.selectAll('.col-sortable span')
                .attr('class', 'glyphicon glyphicon-sort glyphicon-hiddenclick');
        }
        
        // If it is clicked on what it is currently doing, flip it
        if(clicked == order && option != 'maintain_direction') {
            ascending = ascending == "true" ? "false" : "true";
            this.ops['View']['ascending'].updateInInterface_id(ascending);
        } else if (clicked) { // Otherwise it's a new order
            order = clicked;
            this.ops['View']['order'].updateInInterface_id(order);
            if(option != 'maintain_direction') {
                ascending = order == 'Collection' ? 'true' : 'false';
                this.ops['View']['ascending'].updateInInterface_id(ascending);   
            }
        }
        
        // Sort the columns
        if(this.ops['View']['hierarchical'].is('true')) {
            var quantity = order.replace(' ', '');
            if(quantity == 'Collection') quantity = 'Label';
            if(['Tweets', 'Originals', 'Retweets', 'Replies', 'Quotes'].includes(quantity) 
              && this.ops['Counts']['Distinct'].is('Distinct')) {
                quantity = 'Distinct' + quantity;
            }
            var ascending_minmax = ascending == 'true' ? 'Min' : 'Max';
            var ascending_bin = ascending == 'true' ? 1 : -1;
            
            table_body.selectAll('tr').sort(function(a, b) {
                // Get possible values
                var A2 = a.Level == 2 ? a[quantity] : null;
                var B2 = b.Level == 2 ? b[quantity] : null;
                var A1 = a.Level == 2 ? a.Event[quantity] : a.Level == 1 ? a[quantity] : null;
                var B1 = b.Level == 2 ? b.Event[quantity] : b.Level == 1 ? b[quantity] : null;
                var Atype = a.Level == 0 ? a : a['Event Type'];
                var Btype = b.Level == 0 ? b : b['Event Type'];
                var A0 = Atype[quantity] || Atype[quantity + '_' + ascending_minmax];
                var B0 = Btype[quantity] || Btype[quantity + '_' + ascending_minmax];
//                    console.log(A0, A1, A2, a.Level, a.Label);
//                    console.log(B0, B1, B2, b.Level, b.Label);

                // Compare Event Types
                if(!A0 && !B0) return 0;
                if(!A0) return 1;
                if(!B0) return -1;
                if(A0 < B0) return -1 * ascending_bin;
                if(A0 > B0) return 1 * ascending_bin;
//                if(a.Level == 0 && b.Level == 0) return 0;
                if(a.Level == 0 && b.Level > 0) return -1;
                if(a.Level > 0 && b.Level == 0) return 1;

                // Compare Events
                if(!A1 && !B1) return 0;
                if(!A1) return 1;
                if(!B1) return -1;
                if(A1 < B1) return -1 * ascending_bin;
                if(A1 > B1) return 1 * ascending_bin;
//                if(a.Level == 0 && b.Level == 0) return 0;
                if(a.Level == 1 && b.Level > 1) return -1;
                if(a.Level > 1 && b.Level == 1) return 1;

                // Compare Subsets
                if(!A2 && !B2) return 0;
                if(!A2) return 1;
                if(!B2) return -1;
                if(A2 < B2) return -1 * ascending_bin;
                if(A2 > B2) return 1 * ascending_bin;

                return 0;
            });
        } else {
            var ascending_minmax = ascending == 'true' ? 'Max' : 'Min';
            var ascending_bin = ascending == 'true' ? 1 : -1;
            if(order == 'ID') {
                table_body.selectAll('tr').sort(function(a, b) {
                    var A = parseInt(a.ID); var B = parseInt(b.ID);
                    if(a.Level == 0) {
                        A = A || a['ID_' + ascending_minmax];
                    }
                    if(b.Level == 0) {
                        B = B || b['ID_' + ascending_minmax];
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
                if(['Tweets', 'Originals', 'Retweets', 'Replies', 'Quotes'].includes(quantity) 
                  && this.ops['Counts']['Distinct'].is('Distinct')) {
                    quantity = 'Distinct' + quantity;
                }
                table_body.selectAll('tr').sort(function(a, b) {
                    var A = a[quantity];
                    var B = b[quantity];

                    if(a.Level == 0) {
                        A = A || a[quantity + '_' + ascending_minmax];
                    }
                    if(b.Level == 0) {
                        B = B || b[quantity + '_' + ascending_minmax];
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
                console.log(result);
                return;
            }
            
            // Update values
            result = JSON.parse(result)[0];
            
            var quantities = ['Tweets', 'DistinctTweets', 
                          'Originals', 'DistinctOriginals', 'Retweets', 'DistinctRetweets', 
                          'Replies', 'DistinctReplies', 'Quotes', 'DistinctQuotes', 
                          'FirstTweet', 'LastTweet'];
            quantities.forEach(function (quantity) {
                d[quantity] = parseInt(result[quantity]) || 0;
            });
            
            this.updateTableCounts(row);

            // Remove loading sign
            prog_bar.end();
        }.bind(this));
    },
    openTimeseries: function(d) {
        var state = JSON.stringify({event: d.ID});
        window.open('index.html#' + state);
    },
    openCodingReport: function(d) {
        var state = JSON.stringify({subset: d.ID});
        window.open('coding.html#' + state);
    }
};

function initialize() {
    SR = new StatusReport();
    
    SR.init();
}
window.onload = initialize;