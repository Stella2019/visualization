
function TimeseriesModel (app) {
    this.app = app;
    this.connection = new Connection();
    this.streamTimeseries = new Connection();
    
    this.time = {
        stamps: [],
        min: new Date(),
        max: new Date(),
        n: 0,
        map: {}
    }
    this.series_count = {};
    this.series_distinct = {};
    this.series_exposure = {};
    
    this.types = ['Original', 'Retweet', 'Reply', 'Quote'];
    this.counts = ['Count', 'Distinct', 'Exposure'];
    
    this.init();
}
TimeseriesModel.prototype = {
    init: function() {
        this.setTriggers();
    },
    setTriggers: function() {
        triggers.on('event:updated', this.loadTimeseries.bind(this, 'event'));
        triggers.on('timeseries:loaded', this.parseTimeseries.bind(this));
//        triggers.on('timeseries:ready', this.parseTimeseries.bind(this));
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
        }
        
        // If event, get timestamps
        if(id == 'event') {
            // Get bounds
            this.time.min = util.date(this.download[0].Time);
            this.time.max = util.date(this.download[this.download.length - 1].Time);
            this.time.map = {};
            
            if(this.time.min.getTime() == this.time.max.getTime()) {
                this.time.max.setMinutes(newthis.time.maxDate.getMinutes() + 1);
            }
            
            // Populate array of timestamps
            this.time.stamps = [];
            this.time.n = 0;
            this.time.map = {};
            for(var timestamp = new Date(this.time.min);
                timestamp <= this.time.max;
                timestamp.setMinutes(timestamp.getMinutes() + 1)) {
                this.time.stamps.push(util.formatDate(timestamp));
                this.time.map[util.formatDate(timestamp)] = this.time.n;
                this.time.n++;
            }
        }
        
        // Add series
            
        // Divide Data into 3 arrays
        var count    = util.zeros(4, this.time.n);
        var distinct = util.zeros(4, this.time.n);
        var exposure = util.zeros(4, this.time.n);
        
        this.download.forEach(function(row) {
            if(!(row.Time in this.time.map)) {
                console.log('bad time for row', row);
                return;
            }
            var i_t = this.time.map[row.Time];
            
            this.types.forEach(function(type, i_y) {
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
    }
};