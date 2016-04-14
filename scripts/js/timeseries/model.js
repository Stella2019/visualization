
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
    
    this.focus = {series: {}, series_arr: []};
    this.context = {series: {}, series_arr: []};
    
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
        triggers.on('event:updated', this.loadTimeseries.bind(this, 'event'));
        triggers.on('timeseries:loaded', this.parseTimeseries.bind(this));
        triggers.on('timeseries:ready', this.prepareContextSeries.bind(this));
        triggers.on('timeseries:add', this.addSeries.bind(this));
        triggers.on('timeseries:clear', this.clearSeries.bind(this));
//        triggers.on('subset:updated', this.loadSubsetTimeseries.bind(this)); // TODO
    },
    loadTimeseries: function(id) {
        var type;
        if(typeof(id) == 'number') {
            type = 'subset';
        } else {
            type = 'event';
            id = this.app.collection.event.ID
        }
        // If there is no event information, end, we cannot do this yet
        if (type == 'event' && $.isEmptyObject(this.app.collection.event)) {
            return;
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
        console.log('Load Subset Timeseries: TODO');
    },
    parseTimeseries: function(id) {
        // Reenable the button to choose the event
        if(id == 'event') {
            d3.select('#choose_Dataset_Event button')
                .attr('disabled', null);
        }
        
        // If there is no data, stop
        if(!this.download || this.download.length == 0) {
            triggers.emit('alert', 'Failure Fetching Timeseries Data from Database');
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
                console.log('bad time for row', row);
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
    },
    prepareContextSeries: function() {
        var unit = this.app.ops['Series']['Unit'].get();
        var type = this.app.ops['Series']['Tweet Types'].get();
        var datapoints = this['series_' + unit].event;
        var typecolors = ['red', 'yellow', 'green', 'blue'];
        
        triggers.emit('context:clearSeries');
        
        if(type == 'any') {
            // sum up
            var series = this.timepoints2Series(datapoints[0].map(function(val, i) {
                return val + datapoints[1][i] + datapoints[2][i] + datapoints[3][i];
            }));
            
            series.id = 'event';
            series.label = 'Whole Event';
            series.color = '#000';
            series.chart = 'context';
            
            triggers.emit('context:add series', series);
        } else if (type == 'split') {
            
            this.types.forEach(function(curtype, i_y) {
                var series = this.timepoints2Series(datapoints[i_y]);
                
                series.id = curtype;
                series.label = curtype;
                series.color = typecolors[i_y];
                series.chart = 'context';
                
                triggers.emit('context:add series', series);
            }, this)
            
        } else {
            var i_y = this.types.indexOf(type);
            var series = this.timepoints2Series(datapoints[i_y]);
            
            series.id = type;
            series.label = type;
            series.color = typecolors[i_y];
            series.chart = 'context';
            triggers.emit('context:add series', series);
        }
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
        this[chart] = {series: {}, series_arr: []};
        
        triggers.emit(chart + ':place series');
    },
    addSeries: function(series) {
        if(!['context', 'focus'].includes(series.chart)) return;
        
        var chart = this[series.chart];
        
        chart.series[series.id] = series;
        chart.series_arr.push(series);
        chart.series_arr.sort(this.app.legend.cmp.bind(this));
        
        triggers.emit(series.chart + ':set series', chart);
    },
};