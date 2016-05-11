function TimeseriesModel (app) {
    this.app = app;
    this.connection = new Connection();
    this.streamTimeseries = new Connection();
    
    this.time = {
        min: new Date(),
        max: new Date(),
        stamps: [],
        stamp_index: {},
        minutes: [],
        tenminutes: [],
        hours: [],
        days: [],
        indices: [],
    }
    this.series_count = {};
    this.series_distinct = {};
    this.series_exposure = {};
    
    this.focus = {name: 'focus', series: {}, series_arr: []};
    this.context = {name: 'context', series: {}, series_arr: []};
    
    this.typesC = ['Original', 'Retweet', 'Reply', 'Quote'];
    this.types = ['original', 'retweet', 'reply', 'quote'];
    this.units = ['Count', 'Distinct', 'Exposure'];
    
    this.stack = d3.layout.stack()
        .values(function (d) { return d.values; })
        .x(function (d) { return d.timestamp; })
        .y(function (d) { return d.value; })
        .out(function (d, y0, y) { 
            d.y0 = y0;
            d.y = y;
            d.value0 = y0;
        })
        .order("reverse");
    
    this.init();
}
TimeseriesModel.prototype = {
    init: function() {
        this.setTriggers();
    },
    setTriggers: function() {
        triggers.on('event:updated', this.setEvent.bind(this));
        triggers.on('time_window:updated', this.loadTimeseries.bind(this, 'event'));
        triggers.on('timeseries:load', this.loadTimeseries.bind(this));
        triggers.on('timeseries:loaded', this.parseTimeseries.bind(this));
        triggers.on('timeseries:ready', this.prepareTimeseries.bind(this));
        triggers.on('timeseries:add', this.addSeries.bind(this));
        triggers.on('timeseries:clear', this.clearSeries.bind(this));
        triggers.on('timeseries:stack', this.stackSeries.bind(this));
        
        // Subset triggers
        triggers.on('subsets:updated', this.setSubsets.bind(this));
        triggers.on('subset_load:ready', this.loadSubsetTimeseries.bind(this));
        triggers.on('subset_load:continue', this.continueLoadingSubsetTimeseries.bind(this));
        
        // Triggers that need to be better set
        triggers.on('chart:resolution change', this.prepareTimeseries.bind(this));
    },
    setEvent: function(event) {
        this.subset_ids = [];
        
//        triggers.emit('timeseries:load', 'event');
    },
    setSubsets: function() {
        this.subsets = this.app.collection.subsets;
        this.subset_ids = this.app.collection.subsets_arr.map(d => parseInt(d.ID));
        
//        triggers.emit('subset_load:ready', 'event');
    },
    loadTimeseries: function(id) {
        var type;
        if(typeof(id) == 'number') {
            type = 'subset';
        } else {
            // If there is no event information, end
            if (!this.app.collection.event || !('ID' in this.app.collection.event)) {
                return;
            }
            type = 'event';
            id = this.app.collection.event.ID;
        }
        if(this.streamTimeseries)
            this.streamTimeseries.stop();

        // Clear the raw data objects
        this.download = [];
        
        if(type == 'event') {
            d3.select('#choose_Dataset_Event button')
                .attr('disabled', true);
        }
        
        // Send a signal to start loading the event
        var args = {
            name: 'load_' + type + '_timeseries',
            url: 'timeseries/get',
            post: {
                collection: type,
                id: id
            },
            quantity: 'time',
            min: new Date(this.app.ops['Dataset']['Time Min'].date),
            max: new Date(this.app.ops['Dataset']['Time Max'].date),
            time_res: 3,
            failure_msg: 'Error loading data',
            progress_text: 'Getting ' + type + ' ' + id + ' Timeseries',
            on_finish: triggers.emitter('timeseries:loaded', type == 'event' ? 'event' : id),
            on_chunk_finish: function(file_data) {
                file_data = d3.csv.parse(file_data);
                this.download = this.download.concat(file_data);
            }.bind(this)
        };
        
        this.streamTimeseries = new Connection(args);
        this.streamTimeseries.startStream();
    },
    loadSubsetTimeseries: function() {
        var time_max = this.app.ops['Dataset']['Time Max'].date.getTime();
        var op_shown = this.app.ops['Series']['Shown'];
        if(this.subset_load && 
           this.subset_load.event == this.app.collection.event.ID) { // Existing event
            if(this.subset_load.time_max <= time_max) { // We already have the necessary datapoints
                // Don't need to reload, return
                this.subset_load.prog.end();
                return;
            }
            // Otherwise we need more data!
        } else {
            // Do we already have subsets listed as shown?
            var subsets = op_shown.get();
            
            // If we have subsets in common with above, then we can load as usual
            var intersect = util.lintersect(this.subset_ids, subsets);
            if(intersect && intersect.length > 0) {
                op_shown.set(intersect);
            } else {
                // Otherwise we will just put the new ones in!
                op_shown.set(this.subset_ids.map(e => e));
            }
            this.app.ops.recordState();
        }
        
        this.subset_load = {
            event: this.app.collection.event.ID,
            subsets: this.subset_ids,
            index: -1,
            time_max: time_max,
        };
        
        var subset_progress_bar = new Progress({
            style: 'page40',
            color: 'info',
            steps: this.subset_ids.length,
            text: '{cur}/{max} Subset\'s Loaded',
        });
        this.subset_load.prog = subset_progress_bar;
        
        subset_progress_bar.start();
        triggers.emit('subset_load:continue');
    },
    continueLoadingSubsetTimeseries: function() {
        if(this.subset_load.index >= this.subset_load.subsets.length) {
            // Then we are probably done and we can stop, but start a new process to verify
            console.log('done?');
            triggers.emit('subset_load:ready');
            return;
        }
        
        this.subset_load.index++;
        this.subset_load.prog.update(this.subset_load.index);
        
        var subset = this.subset_load.subsets[this.subset_load.index];
        triggers.emit('timeseries:load', subset);
    },
    parseTimeseries: function(id) {
        // Reenable the button to choose the event
        if(id == 'event') {
            d3.select('#choose_Dataset_Event button')
                .attr('disabled', null);
        }
        
        // If there is no data, stop
        if(!this.download || this.download.length == 0) {
            if(typeof(id) == 'number') { // Continue loading other subsets
                triggers.emit('subset_load:continue');
            } else {
                triggers.emit('alert', 'Failure fetching event timeseries data from database');
            }
            return;
        }
        
        // If event, get timestamps
        if(id == 'event') {
            // Get bounds
            this.time.min = util.date(this.download[0].Time);
            this.time.max = util.date(this.download[this.download.length - 1].Time);
            
            this.buildTimeArrays();
        }
        
        // Add series
        // Divide Data into an array for each unit
        var count    = util.zeros(4, this.time.minutes.length);
        var distinct = util.zeros(4, this.time.minutes.length);
        var exposure = util.zeros(4, this.time.minutes.length);
        
        // Iterate through rows, adding them to the arrays
        this.download.forEach(function(row) {
            if(!(row.Time in this.time.stamp_index)) {
                console.log('bad time for row', row, this.time);
                return;
            }
            var i_t = this.time.stamp_index[row.Time];
            
            this.typesC.forEach(function(type, i_y) {
                count[i_y][i_t]    = parseInt(row[type]);
                distinct[i_y][i_t] = parseInt(row[type + 'Distinct']);
                exposure[i_y][i_t] = parseInt(row[type + 'Exposure']);
            });
        }, this);
        
        this.series_count[id] = count;
        this.series_distinct[id] = distinct;
        this.series_exposure[id] = exposure;
        
        // Clear download object
        this.download = [];
        
        triggers.emit('timeseries:ready', id);
        triggers.emit('subset_load:continue');
    },
    prepareTimeseries: function(id) {
        var cols = d3.scale.category10();
        
        var unit = this.app.ops['Series']['Unit'].get();
        if(!id) { // Then prepare them all!
            triggers.emit('timeseries:clear', 'focus'); // Not necessary though, TODO
            
            triggers.emit('timeseries:ready', 'event');
            this.subset_load.subsets.forEach(triggers.emitter('timeseries:ready'));
        } else if(id == 'event' || !id) {
            this.prepareContextSeries(id);
        } else {
            var datapoints = this['series_' + unit][id];
            if(!datapoints) return;
            
            var series = this.timepoints2Series(datapoints[0].map(function(val, i) {
                return val + datapoints[1][i] + datapoints[2][i] + datapoints[3][i];
            }));
            
            series.ID = id;
            series.Label = 'Subset ' + id;
            series.color = cols(id);
            series.chart = 'focus';
            series.shown = this.app.ops['Series']['Shown'].get().includes(id);
            
            triggers.emit('timeseries:add', series);
        }
    },
    prepareContextSeries: function() {
        var unit = this.app.ops['Series']['Unit'].get();
        var type = this.app.ops['Series']['Tweet Types'].get();
        var datapoints = this['series_' + unit].event;
        var typecolors = ['red', 'yellow', 'green', 'blue'];
        
        triggers.emit('timeseries:clear', 'context');
        
        if(type == 'any') {
            // sum up
            var series = this.timepoints2Series(datapoints[0].map(function(val, i) {
                return val + datapoints[1][i] + datapoints[2][i] + datapoints[3][i];
            }));
            
            series.ID = 'event';
            series.Label = 'Whole Event';
            series.color = '#000';
            series.chart = 'context';
            series.shown = true;
            
            triggers.emit('timeseries:add', series);
        } else if (type == 'split') {
            
            this.types.forEach(function(curtype, i_y) {
                var series = this.timepoints2Series(datapoints[i_y]);
                
                series.ID = curtype;
                series.Label = curtype;
                series.color = typecolors[i_y];
                series.chart = 'context';
                series.shown = true;
                
                triggers.emit('timeseries:add', series);
            }, this)
            
        } else {
            var i_y = this.types.indexOf(type);
            var series = this.timepoints2Series(datapoints[i_y]);
            
            series.ID = type;
            series.Label = type;
            series.color = typecolors[i_y];
            series.chart = 'context';
            series.shown = true;
            triggers.emit('timeseries:add', series);
        }
        
        // Now get the subsets
        triggers.emit('subset_load:ready');
    },
    buildTimeArrays: function() {
        // Populate array of timestamps
        this.time.stamps = [];
        this.time.stamp_index = {};
        this.time.minutes = [];
        this.time.tenminutes = [];
        this.time.hours = [];
        this.time.days = [];
        this.time.indices = [];
        for(var timestamp = new Date(this.time.min);
            timestamp <= this.time.max;
            timestamp.setMinutes(timestamp.getMinutes() + 1)) {
            var formattedTime = util.formatDate(timestamp);
            this.time.stamps.push(formattedTime);
            this.time.stamp_index[formattedTime] = this.time.minutes.length;
            
            // Add map to values for different resolutions
            this.time.minutes.push(new Date(timestamp));
            
            var roundedTime = new Date(timestamp);
            roundedTime.setMinutes(Math.floor(roundedTime.getMinutes() / 10) * 10);
            if(this.time.tenminutes.length == 0 || this.time.tenminutes.slice(-1)[0].getTime() != roundedTime.getTime()) {
                this.time.tenminutes.push(new Date(roundedTime));
                
                roundedTime.setMinutes(0);
                if(this.time.hours.length == 0 || this.time.hours.slice(-1)[0].getTime() != roundedTime.getTime()) {
                    this.time.hours.push(new Date(roundedTime));

                    roundedTime.setHours(0);
                    if(this.time.days.length == 0 || this.time.days.slice(-1)[0].getTime() != roundedTime.getTime()) {
                        this.time.days.push(new Date(roundedTime));
                    }
                }
            }
            
            this.time.indices.push([
                this.time.minutes.length - 1,
                this.time.tenminutes.length - 1,
                this.time.hours.length - 1,
                this.time.days.length - 1,
            ]);
        }
        
        triggers.emit('chart:context time');
    },
    timepoints2Series: function(timepoints) {
        var resolution = this.app.ops['View']['Resolution'].get();
        var i_r = ['minute', 'tenminute', 'hour', 'day'].indexOf(resolution);
        var timepoints_rolled = util.zeros(this.time[resolution + 's'].length);
    
        // Roll up timepoints
        timepoints.forEach(function(val, i_t) {
//            console.log(val, i_t, this.time.indices[i_t], i_r, this.time.indices[i_t][i_r]);
            timepoints_rolled[this.time.indices[i_t][i_r]] += val;
        }, this)
        
        // Convert to array of tuples
        var values = timepoints_rolled.map(function(val, i_tr) {
//            console.log(val, i_tr, this.time[resolution + 's'][i_tr]);
            return {
                value: val,
                timestamp: new Date(this.time[resolution + 's'][i_tr])
            };
        }, this);
        
        // Build other series metrics
        var series = {
            values: values,
            sum: d3.sum(timepoints_rolled),
            max: d3.max(timepoints_rolled)
        }
        
        return series;
    },
    clearSeries: function(chart) {
        if(!['context', 'focus'].includes(chart)) return;
        this[chart] = {name: chart, series: {}, series_arr: []};
        
        triggers.emit(chart + ':place series');
    },
    addSeries: function(series) {
        if(!['context', 'focus'].includes(series.chart)) return;
        
        var chart = this[series.chart];
        
        chart.series[series.ID] = series;
        chart.series_arr.push(series);
        chart.series_arr.sort(this.app.legend.cmp.bind(this));
        
        triggers.emit('legend:series', series);
        triggers.emit('timeseries:stack', chart);
    },
    stackSeries: function(chart) {
        if(!chart) { // Stack both!
            triggers.emit('timeseries:stack', this.focus);
            triggers.emit('timeseries:stack', this.context);
            return;
        }
        
        var plot_type = this.app.ops['View']['Plot Type'].get();
        var series = chart.series_arr;
        
        if (plot_type == "wiggle") {
            this.stack.offset("wiggle");
        } else if (plot_type == "stream_expand") {
            this.stack.offset("expand");
        } else if (plot_type == "stream") {
            this.stack.offset("silhouette");
        } else {
            this.stack.offset("zero");
        }
        
        // Only stack plots being shown
        var series_to_plot = series.filter(series => series.shown);
        
        if(plot_type == "percent") {
            data_100 = series_to_plot.map(function(series) {
                var new_series = JSON.parse(JSON.stringify(series)); // Cheap cloning
                new_series.values = new_series.values.map(function(datum, i) {
                    var new_datum = datum;
                    new_datum.timestamp = new Date(new_datum.timestamp);
                    new_datum.value *= 100 / data.time_totals[i];
                    return new_datum;
                });
                return new_series;            
            });
            this.stack(data_100);
        } else {
            this.stack(series_to_plot);
        }
        
        // Convert to separate area plot if that's asked for
        var n_series = series_to_plot.length;
        if(n_series > 0) {
            var n_datapoints = series_to_plot[0].values.length;
            if(plot_type == "separate") {
                for (var i = n_series - 1; i >= 0; i--) {
                    series_to_plot[i].offset = 0;
                    if(i < n_series - 1) {
                        series_to_plot[i].offset  = series_to_plot[i + 1].offset;
                        series_to_plot[i].offset += series_to_plot[i + 1].max;
                    }

                    series_to_plot[i].values.forEach(function(datum) {
                        datum.value0 = series_to_plot[i].offset;
                    });
                }
            } 
        }
        
        triggers.emit(chart.name + ':set series', chart);
    },
};