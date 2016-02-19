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
                SR.getMoreInformation();
        });

        data.callPHP('collection/getRumors', {}, function(d) {
            SR.rumors_arr = JSON.parse(d);
            
            datasets--;
            if(datasets == 0)
                SR.getMoreInformation();
        });
    },
    getMoreInformation: function() {
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
            var counts 
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
                SR.buildTable();
        });
        // Get the number of tweets for each rumor
        data.callPHP('timeseries/getStatistics', {}, function(d) {
            var counts 
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
                SR.buildTable();
        });
        // Get the number of tweets for each rumor
        data.callPHP('coding/rumorPeriodCounts', {}, function(d) {
            var counts 
            try {
                counts = JSON.parse(d);
            } catch(err) {
                console.log(d);
                return;
            }
            
            counts.forEach(function(rumorperiod) {
                if(rumorperiod.Period == 0)
                    SR.rumors[rumorperiod.Rumor].Codes = rumorperiod.Count;
            });
            
//            datasets--;
//            if(datasets == 0)
                SR.buildTable();
        });
        
        SR.buildDropdowns();
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
            callback: SR.buildTable
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
                       'Tweets', 'Codes', 'Timeseries<br /><small>Minutes</small>',
                       'First Tweet', 'Last Tweet', 
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
                    .attr('class', 'row_event');
                
                event.rumors.forEach(function(rumor) {
                    table_body.append('tr')
                        .data([rumor])
                        .attr('class', 'row_rumor');
                });
            });
        })
        
        // Populate columns
        table_body.selectAll('tr')
            .append('td')
            .html(function(d) { return d.Label; })
            .style('padding-left', function(d) { return 10 + d.Level * 20 + 'px';})
            .style('font-weight', function(d) { return d.Level == 1 ? 'bold' : 'normal' });
        
        // Number of Tweets
        table_body.selectAll('tr')
            .append('td')
            .html(function(d) {
                if(d.Level == 0)
                    return d3.sum(d.events, function(e) { return e.Tweets; });
                return 'Tweets' in d ? d.Tweets : '';
            })
        table_body.selectAll('tr')
            .append('td')
            .html(function(d) { return 'Codes' in d ? d.Codes : ''; })
        table_body.selectAll('tr')
            .append('td')
            .html(function(d) { 
                if(!('Datapoints' in d)) return '';
                var days = Math.floor(d.Datapoints / 60 / 24);
                var hours = Math.floor(d.Datapoints / 60) % 24;
                var minutes = d.Datapoints % 60;
                if(days) return days + 'd ' + hours + 'h ' + minutes + 'm';
                if(hours) return hours + 'h ' + minutes + 'm';
                return minutes + 'm';
            })
        
        // Times
        table_body.selectAll('tr')
            .append('td')
            .html(function(d) { return 'First' in d ? d.First || '-' : ''; })
        table_body.selectAll('tr')
            .append('td')
            .html(function(d) { return 'Last' in d ? d.Last || '-' : ''; })
        
        // Buttons
        table_body.selectAll('tr.row_event, tr.row_rumor')
            .append('td')
            .attr('class', 'cell_options')
            .append('button')
            .attr('class', 'btn btn-xs btn-default')
            .append('span')
            .attr('class', 'glyphicon glyphicon-signal');

        table_body.selectAll('tr.row_rumor td.cell_options')
            .append('button')
            .attr('class', 'btn btn-xs btn-default')
            .text('Codes')
            .style('margin-left', '5px');
    }
};

function initialize() {
    SR = new StatusReport();
    options = new Options();
    data = new Data();
    
    SR.getData();
}
window.onload = initialize;