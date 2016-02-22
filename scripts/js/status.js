var SR, options, data;

function StatusReport() {
    this.events = {};
    this.events_arr = [];
    this.rumors = {};
    this.rumors_arr = [];
    this.event_types = {};
    this.event_types_arr = [];
}
StatusReport.prototype = {
    getData: function() {
        var datasets = 2;
            
        data.callPHP('collection/getEvents', {}, function(d) {
            SR.events_arr = JSON.parse(d);
            datasets--;
            if(datasets == 0)
                SR.configureData();
        });

        data.callPHP('collection/getRumors', {}, function(d) {
            SR.rumors_arr = JSON.parse(d);
            
            datasets--;
            if(datasets == 0)
                SR.configureData();
        });
    },
    configureData: function() {
        // Link all of the data
        SR.events_arr.forEach(function(event) {
            // Add fields
            event.rumors = [];
            event.Label = event.DisplayName || event.Name;
            event.Level = 1;
            event.Tweets = 0;
            event.Datapoints = 0;
            
            // Add to event type list (or make new event type list)
            var type = event.Type;
            if(type in SR.event_types) {
                SR.event_types[type].events.push(event);
            } else {
                var new_event_type = {
                    Level: 0,
                    Label: type,
                    events: [event]
                }
                SR.event_types[type] = new_event_type;
                SR.event_types_arr.push(new_event_type);
            }
            
            // Add to indiced object
            SR.events[event.ID] = event;
        });
        SR.rumors_arr.forEach(function(rumor) {
            // Add fields
            rumor.Label = rumor.Name;
            rumor.Level = 2;
            rumor.Tweets = 0;
            rumor.Codes = 0;
            
            rumor.Event = SR.events[rumor.Event_ID];
            if(rumor.Event.rumors) {
                rumor.Event.rumors.push(rumor);
            } else {
                rumor.Event.rumors = [rumor];
            }
            
            // Add to indiced object
            SR.rumors[rumor.ID] = rumor;
        });
        
        setTimeout(SR.loadMoreData, 100);
        SR.buildDropdowns();
    },
    loadMoreData: function() {
        var ints = ['Tweets', 'DistinctTweets', 'CodedTweets', 'Datapoints'];
        var fields = ['FirstTweet', 'LastTweet', 'FirstDatapoint', 'LastDatapoint'];
        
        // Get the number of tweets for each rumor
        data.callPHP('count/get', {}, function(d) {
        console.log('gotData', d);
            var counts;
            try {
                counts = JSON.parse(d);
            } catch(err) {
                console.log(d);
                return;
            }
            
            counts.forEach(function(count) {
                var collection = 'events';
                if(count.Type == 'Rumor') {
                    collection = 'rumors';
                }
                
                ints.forEach(function(field) {
                    if(field in count) {
                        SR[collection][count.ID][field] = parseInt(count[field]);
                    }
                });
                fields.forEach(function(field) {
                    if(field in count) {
                        SR[collection][count.ID][field] = count[field];
                    }
                });
            });
            
            SR.computeAggregates();
        });
        
        return;
        
        // Get additional data
        var datasets = 3;

        // Get the number of tweets for each event
//        data.callPHP('collection/getEventStatistics', {}, function(d) {
//            var eventTweets = JSON.parse(d);
//            
//            eventTweets.forEach(function(event) {
//                SR.events[event.ID].nTweets = event.nTweets;
//            });
//            
//            datasets--;
//            if(datasets == 0)
//                SR.buildTable();
//        });
        
        // Get the number of tweets for each rumor
        data.callPHP('collection/getRumorStatistics', {}, function(d) {
            var counts;
            try {
                counts = JSON.parse(d);
            } catch(err) {
                console.log(d);
                return;
            }
            
            counts.forEach(function(row) {
                SR.rumors[row.ID].Tweets = row.Tweets;
                SR.rumors[row.ID].First = row.First;
                SR.rumors[row.ID].Last  = row.Last;
            });
            
//            datasets--;
//            if(datasets == 0)
                SR.computeAggregates();
        });
        // Get the number of tweets for each rumor
        data.callPHP('timeseries/getStatistics', {}, function(d) {
            var counts ;
            try {
                counts = JSON.parse(d);
            } catch(err) {
                console.log(d);
                return;
            }
            
            counts.forEach(function(row) {
                SR.events[row.ID].Datapoints = row.Count;
                SR.events[row.ID].First = row.First;
                SR.events[row.ID].Last  = row.Last;
            });
            
//            datasets--;
//            if(datasets == 0)
                SR.computeAggregates();
        });
        // Get the number of tweets for each rumor
        data.callPHP('coding/rumorPeriodCounts', {}, function(d) {
            var counts ;
            try {
                counts = JSON.parse(d);
            } catch(err) {
                console.log(d);
                return;
            }
            
            counts.forEach(function(rumorperiod) {
                if(rumorperiod.Period == 0)
                    SR.rumors[rumorperiod.Rumor].CodedTweets = rumorperiod.Count;
            });
            
//            datasets--;
//            if(datasets == 0)
                SR.computeAggregates();
        });
    },
    computeAggregates: function() {
        SR.event_types_arr.forEach(function(d) {
            d.Tweets         = d3.sum(d.events, function(e) { return e.Tweets         || 0; });
            d.DistinctTweets = d3.sum(d.events, function(e) { return e.DistinctTweets || 0; });
            d.CodedTweets    = d3.sum(d.events, function(e) { return e.CodedTweets    || 0; });
            d.Datapoints     = d3.sum(d.events, function(e) { return e.Datapoints     || 0; });
        });
        
        SR.updateTableCounts();
    },
    buildDropdowns: function() {
        options.choice_groups = [];
        options.initial_buttons = ['levels', 'empties'];
        options.record = options.initial_buttons;
        
        options.levels = new Option({
            title: 'Show',
            labels: ['All Levels',
                     'Event Types & Events',
                     'Events',
                     'Events & Rumors',
                     'Rumors'],
            ids:    ["all", "etr", "e", "er", "r"],
            default: 0,
            type: "dropdown",
            parent: '#status_table_header',
            callback: SR.buildTable
        });
        options.empties = new Option({
            title: 'Show Rows with No Tweets',
            labels: ['Yes', 'No'],
            ids:    ["true", "false"],
            default: 1,
            type: "dropdown",
            parent: '#status_table_header',
            callback: SR.setVisibility
        });        
        
        // Start drawing
        options.init();
        
        // Change some of the appearances
        d3.selectAll('.choice')
            .style('vertical-align', 'top');
        d3.selectAll('.btn-primary')
            .classed('btn-default', true)
            .classed('btn-primary', false);
        
        //status....
        SR.buildTable();
    },
    buildTable: function() {
        var columns = ['Collection',
                       'Tweets', 'Distinct Tweets', 'Coded Tweets', 'Timeseries<br /><small>Minutes</small>',
                       'First Tweet', //'Last Tweet', 
                       'Open <span class="glyphicon glyphicon-new-window"></span>'];
        
        d3.select('#table-container').selectAll('*').remove();
        var table = d3.select('#table-container')
            .append('table')
            .attr('class', 'table')
        
        table.append('thead')
            .append('tr')
            .selectAll('th')
            .data(columns)
            .enter()
            .append('th')
            .html(function(d) { return d; });
        
        var table_body = table.append('tbody');
        
        // Add table rows
        SR.event_types_arr.forEach(function(event_type) {
            table_body.append('tr')
                .data([event_type])
                .attr('class', 'row_type');
            
            event_type.events.forEach(function(event) {
                table_body.append('tr')
                    .data([event])
                    .attr('class', function(d) { return 'row_event row_event_' + d.ID; });
                
                event.rumors.forEach(function(rumor) {
                    table_body.append('tr')
                        .data([rumor])
                        .attr('class', function(d) { return 'row_rumor row_rumor_' + d.ID; });
                });
            });
        })
        
        // Populate columns
        table_body.selectAll('tr')
            .append('td')
            .html(function(d) { return d.Label; })
            .style('padding-left', function(d) { return 10 + d.Level * 20 + 'px';})
            .style('font-weight', function(d) { return d.Level == 1 ? 'bold' : 'normal' })
            .attr('class', 'cell-label')
            .append('span')
            .attr('class', 'button-recount')
            .html(function(d) { return d.Level > 0 ? 'ID: ' + d.ID : ''; });
        
        // Counts
        table_body.selectAll('tr')
            .append('td')
            .attr('class', 'cell-tweets cell-count');
        table_body.selectAll('tr')
            .append('td')
            .attr('class', 'cell-distincttweets cell-count');
        table_body.selectAll('tr')
            .append('td')
            .attr('class', 'cell-codedtweets cell-count');
        table_body.selectAll('tr')
            .append('td')
            .attr('class', 'cell-datapoints cell-count');
        
        // Times
        table_body.selectAll('tr')
            .append('td')
            .attr('class', 'cell-firstdate');
//        table_body.selectAll('tr')
//            .append('td')
//            .attr('class', 'cell-lastdate');
        
        // Buttons
        table_body.selectAll('tr.row_event, tr.row_rumor')
            .append('td')
            .attr('class', 'cell_options')
            .append('button')
            .attr('class', 'btn btn-xs btn-default')
            .append('span')
            .attr('class', 'glyphicon glyphicon-edit')
            .on('click', SR.edit);

        table_body.selectAll('tr.row_event td.cell_options')
            .append('button')
            .attr('class', 'btn btn-xs btn-default')
            .style('margin-left', '5px')
            .append('span')
            .attr('class', 'glyphicon glyphicon-signal')
            .on('click', SR.openTimeseries);
        
        table_body.selectAll('tr.row_rumor td.cell_options')
            .append('button')
            .attr('class', 'btn btn-xs btn-default')
            .text('Codes')
            .style('margin-left', '5px')
            .on('click', SR.openCodingReport);
        
        // Set the counts
        SR.updateTableCounts();
    },
    setVisibility: function() {
        var table_body = d3.select('tbody');
        
        table_body.selectAll('tr')
            .style('display', 'table-row');
        if(options.empties.is('false')) {
            d3.selectAll('tr.row-zero')
                .style('display', 'none');
        }
    },
    updateTableCounts: function() {
        var table_body = d3.select('tbody');
        
        // Update the text of rows with the counts
//        table_body.selectAll('td.cell-tweets')
//            .html(function(d) {
//                if('DistinctTweets' in d)
//                    return ('Tweets' in d ? d.Tweets + '<br />' : '') 
//                        + '<small>' + d.DistinctTweets + '</small>'; 
//                return 'Tweets' in d ? d.Tweets : ''; 
//            });
        table_body.selectAll('td.cell-tweets')
            .html(function(d) { return 'Tweets' in d ? d.Tweets : ''; });
        table_body.selectAll('td.cell-distincttweets')
            .html(function(d) { return 'DistinctTweets' in d ? d.DistinctTweets : ''; });
        table_body.selectAll('td.cell-codedtweets')
            .html(function(d) { return 'CodedTweets' in d ? d.CodedTweets : ''; });
        table_body.selectAll('td.cell-datapoints')
            .html(function(d) { 
                if(!('Datapoints' in d)) return '';
                var days = Math.floor(d.Datapoints / 60 / 24);
                var hours = Math.floor(d.Datapoints / 60) % 24;
                var minutes = d.Datapoints % 60;
                if(days) return days + 'd ' + hours + 'h ' + minutes + 'm';
                if(hours) return hours + 'h ' + minutes + 'm';
                return minutes + 'm';
            });
        
        // Append the refresh button
        table_body.selectAll('td.cell-count')
            .append('span')
            .attr('class', 'glyphicon glyphicon-refresh button-recount')
            .on('click', SR.recount);
        
        // Set visibility of zero/non-zero rows
        table_body.selectAll('tr')
            .classed('row-zero', function(d) { return !(d.Tweets || d.Datapoints || d.CodedTweets) ; });
        SR.setVisibility();  
        
        // Dates
        table_body.selectAll('td.cell-firstdate')
            .html(function(d) { return 'FirstTweet' in d ? d.FirstTweet || '-' : ''; });
        table_body.selectAll('td.cell-lastdate')
            .html(function(d) { return 'LastTweet' in d ? d.LastTweet || '-' : ''; });
    },
    edit: function(d) {
        if(d.Level == 1) { // Event
            data.collection = d;
            options.editWindow('collection');
        } else if(d.Level == 2) { // Event
            data.rumor = d;
            options.editWindow('rumor');
        }
    },
    recount: function(d) {
        // Prepare statement
        var div = d3.select(this.parentNode);
        var quantity_class = div.attr('class').split(' ')[0];
        var quantity = quantity_class.includes('coded') ? 'CodedTweets' : 
                   quantity_class.includes('distinct') ? 'DistinctTweets' : 
                   quantity_class.includes('datapoint') ? 'Datapoints' : 'Tweets';
        var post = {
            Collection: d.Level == 1 ? 'Event' : 'Rumor',
            Quantity: quantity,
            ID: d.ID
        }
        
        // Start loading sign
        var loading = new Progress({
            'initial': 100,
            'parent_id': '.row_' + (d.Level == 1 ? 'event' : 'rumor') + '_' + d.ID + ' .' + quantity_class,
            full: true, 
            text: ' '
        });
        loading.start();
//        div.classed('cell-counting', true)
//            .html();
//        var loading = div.append('div')
//            .attr('class', 'loading-count')
//            .html('Loading');
        
        // Start the recount
        data.callPHP('count/compute', post, function(result) {
            if(result.includes('Error')) {
                loading.update(100, 'Error');
                console.log(result);
                return;
            }
            
            // Update value
            var val = JSON.parse(result)[0].Count;
            d[quantity] = val;
            div.html(val);
            
            // Remove loading sign
            loading.end();
        })
    },
    openTimeseries: function(d) {
        window.open('index.html#!collection="' + d.ID + '"');
    },
    openCodingReport: function(d) {
        window.open('coding.html#!rumor="' + d.ID + '"');
    }
};

function initialize() {
    SR = new StatusReport();
    options = new Options();
    data = new Data();
    
    SR.getData();
}
window.onload = initialize;