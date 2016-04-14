function TimeseriesView(app) {
    this.app = app;
    
    this.init();
}

TimeseriesView.prototype = {
    init: function() {
        this.setTriggers();
    },
    setTriggers: function() {
        triggers.on('event_updated', this.setTitle.bind(this));
//        triggers.on('page:resize', );
        $(window).on('resize', this.setChartHeights.bind(this));
        triggers.on('chart:plan resize', this.setChartHeights.bind(this));
        triggers.on('chart:context time', this.setContextTime.bind(this));
        triggers.on('chart:focus time', this.setFocusTime.bind(this));
    },
    buildPage: function() {
        var body = d3.select('body')
            .append('div')
            .attr('id', 'body');
        
        body.append('div')
            .attr('class', 'header')
            .append('span')
            .attr('id', 'chart-title')
            .html('Twitter Collection Timeseries Visualization');
        
        body.append('div')
            .attr('id', 'focus-container')
            .attr('class', 'chart-container')
            .append('svg')
            .attr('id', 'focus')
            .attr('class', 'chart');
        
        body.append('div')
            .attr('id', 'context-container')
            .attr('class', 'chart-container')
            .append('svg')
            .attr('id', 'context')
            .attr('class', 'chart');
        
        body.append('div')
            .attr('class', 'ui-bottom footer')
            .append('div')
            .html('Tweet volume over the whole collection period. Brush over to focus on time.');
        
        triggers.emit('page_built');
    },
    setTitle: function(event) {
         d3.select('#chart-title')
            .html('<small>' + event.Type + ':</small> ' + 
                  event.Label);
    },
    setChartHeights: function(event) {
        // Get constraints
        var page = window.innerHeight;
        var header = parseInt(d3.select('.header').style('height'));
        var footer = parseInt(d3.select('.footer').style('height'));
        
        // Minimum heights
        var focus = 200;
        var context = 120;
        
        // Fill extra space
        // -10 because of page margins I haven't been able to resolve
        // -30 for the padding on the top & bottom
        var extra_space = page - header - footer - focus - context - 10 - 30;
        if(extra_space > 0) {
            var extra_focus = Math.floor(extra_space * 0.75);
            focus += extra_focus;
            context += extra_space - extra_focus;
        }
        
        // Send an event
        triggers.emit('chart:resize', [focus, context]);
    },
    setContextTime: function() {
        // Establish the maximum and minimum time of the data series
        var time_min = this.app.model.time.min;
        var time_max = this.app.model.time.max;
        var time_min_op = this.app.ops['View']['Time Min'];
        var time_max_op = this.app.ops['View']['Time Max'];
        var startTime = time_min_op.get();
        var endTime =   time_max_op.get();
        if(typeof(startTime) == 'string')
            startTime = new Date(startTime);
        if(typeof(endTime) == 'string')
            endTime = new Date(endTime);

        if(startTime.getTime() == endTime.getTime()) {
            startTime = time_min;
            endTime = time_max;
        } else {
            if(startTime < time_min || startTime > time_max)
                startTime = time_min;
            if(endTime < time_min || endTime > time_max)
                endTime = time_max;
        }

        // Set the context and focus domains
        this.app.context.x.domain([time_min, time_max]);
        this.app.focus.x.domain(this.app.context.brush.empty() ? [startTime, endTime] : this.app.context.brush.extent());

        // Initialize the brush if it isn't identical
        if(startTime > time_min || endTime < time_max) {
            this.app.context.brush.extent([startTime, endTime]);
        }

        // Set the time option
        time_min_op.set(startTime);
        time_min_op.min = new Date(time_min);
        time_max_op.set(endTime);
        time_max_op.max = new Date(time_max);
        
        triggers.emit('chart:plan resize');
        triggers.emit('chart:focus time');
    },
    setFocusTime: function (origin) {
        var time_min_op = this.app.ops['View']['Time Min'];
        var time_max_op = this.app.ops['View']['Time Max'];
        var startTime, endTime;
        var brushEvent = false;
        
        // Get the start/end times
        if(origin == 'brush') {
            var times = this.app.context.brush.extent();
            startTime = times[0];
            endTime   = times[1];
            brushEvent = true;
        } else {
            startTime = time_min_op.get();
            endTime = time_max_op.get();
        }
    
        // Bound the start and end times
        if(startTime < time_min_op.min)
            startTime = new Date(time_min_op.min);
        if(endTime > time_max_op.max)
            endTime = new Date(time_max_op.max);
        if(startTime >= endTime ) {
            startTime = new Date(time_min_op.min);
            endTime = new Date(time_max_op.max);
        }
        
        time_min_op.set(startTime);
        time_max_op.set(endTime);
        
        if(startTime > time_min_op.min || endTime < time_max_op.max) {    
            if(!brushEvent) {
                // Update the brush
                this.app.context.brush.extent([startTime, endTime])
                this.app.context.brush(d3.select(".brush").transition());
                this.app.context.brush.event(d3.select(".brush").transition())
            }
        } else {
            d3.selectAll(".brush").call(this.app.context.brush.clear());//brush.clear();
        }
        
        this.app.ops.recordState();
        
        // Move this to the chart itself
        this.app.focus.x.domain(this.app.context.brush.empty() ?
                               this.app.context.x.domain() :
                               this.app.context.brush.extent());
        this.app.focus.svg.selectAll("path.area")
            .attr("d", function(d) { return this.app.focus.area(d.values)});
        this.app.focus.svg.selectAll("path.area_total_line")
            .attr("d", function(d) { return this.app.focus.area_total_line(d)});
        this.app.focus.svg.select(".x.axis")
            .call(this.app.focus.xAxis);
    },
}