function TimeseriesChart(app, id) {
    this.app = app;
    this.id = id;
    
    // Size
    this.canvas_height = 300;
    this.canvas_width = 400;
    this.top    = 10;
    this.right  = 10;
    this.bottom = 20;
    this.left   = 70;
    this.width  = this.canvas_width  - this.left - this.right;
    this.height = this.canvas_height - this.top  - this.bottom;
    
    // Scales
    this.x = d3.time.scale().range([0, this.width])
                .clamp(true);
    this.y = d3.scale.linear().range([this.height, 0]);
    
    // Axes
    this.xAxis = d3.svg.axis()
        .scale(this.x)
        .orient('bottom');
    this.yAxis = d3.svg.axis()
        .scale(this.y)
        .orient('left');
    
    // Getters
    this.dataTimestamp_2_x = function(d) { return this.x(d.timestamp); };
    this.dataValue_2_y     = function(d) { return this.y(d.value);     };
    
    // D3 Functions
    this.area = d3.svg.area()
        .x(this.dataTimestamp_2_x);
    this.color = d3.scale.category10(); // TODO may remove
    // ['Blue', 'Orange', 'Green', 'Red', 'Purple', 'Brown', 'Pink', 'Gray', 'Yellow', 'Teal']
    this.codecolor = d3.scale.category20()
        .domain(['Affirm', 'Affirm2', 'Deny Uncertainty', 'Deny Uncertainty2', 'Neutral', 'Neutral2', 'Deny', 'Deny2', 'Botnet', 'Botnet2', 'Unrelated', 'Unrelated2', 'Uncertainty', 'Uncertainty2', 'Uncodable', 'Uncodable2', 'Neutral Uncertainty', 'Neutral Uncertainty2', 'Affirm Uncertainty', 'Affirm Uncertainy2']);
    
    // Other attributes filled during execution
    this.brush = [];
    this.drag = [];
    this.svg = [];
    this.plotarea = [];
    this.container = [];
    this.y_label = [];
    this.column_highlight = [];
    this.series = {};
    this.series_arr = [];
    
    this.init();
}
TimeseriesChart.prototype = {
    init: function() {
        this.setTriggers();
    },
    setTriggers: function() {
        triggers.on('chart:build', this.build.bind(this));
        triggers.on('chart:shape', this.setShape.bind(this));
        triggers.on('chart:y-scale', this.setYScale.bind(this));
        
        // Generic chart functions
        triggers.on('chart:place series', this.placeSeries.bind(this));
        triggers.on('chart:render series', this.renderSeries.bind(this));
        
        // Specific chart functions
        triggers.on(this.id + ':resize', this.adjustSize.bind(this));
        triggers.on(this.id + ':time_window', this.setTimeWindow.bind(this));
        triggers.on(this.id + ':set series', this.setSeries.bind(this));
        triggers.on(this.id + ':place series', this.placeSeries.bind(this));
        triggers.on(this.id + ':render series', this.renderSeries.bind(this));
        
        triggers.on(this.id + ':render y-axis', this.setYAxes.bind(this));
    },
    build: function() {
        this.container = d3.select('#' + this.id + '-container');
        this.svg = d3.select('#' + this.id);
        this.buildElements();
        this.setShape();
        if(this.id == 'context') {
            this.setContext();
        }
//        this.setColorScale();
        
        triggers.emit('chart:plan resize');
//        setTimeout(this.adjustSize.bind(this), 2000);
    },
    buildElements: function() {
        this.plotarea = this.svg.append("g")
            .attr("class", "plot")
            .attr("transform", "translate(" + this.left + "," + this.top + ")");
        
//        this.y_label = this.svg.append("text")
//            .attr('class', 'y_label')
//            .attr("y", 0 - this.left)
//            .attr("x", 0 - (this.height / 2))
//            .attr("dy", "1em")
//            .text("Count of <Subset> Tweets Every <Resolution>");

        this.column_highlight = this.plotarea.append("path")
            .attr('class', 'column_highlight');
        
        this.xAxis_element = this.plotarea.append('g').attr('class', 'x axis');
        this.xAxis_element.attr('class','x axis')
            .attr('transform', 'translate(0,' + this.height + ')')
            .transition().duration(1000)
            .call(this.xAxis); 
        
        this.yAxis_element = this.plotarea.append('g').attr('class', 'y axis');
    },
    adjustSize: function(sizes) {
        if(!this.container || this.container.length == 0) {
            return;
        }
        
        // Recompute width and height
        this.canvas_width  = sizes == undefined ? parseInt(this.container.style('width')) : sizes[1];
        this.canvas_height = sizes == undefined ? 200 : sizes[0];
        this.svg.style({
            height: this.canvas_height, 
            width: this.canvas_width, 
        })
        this.width  = this.canvas_width  - this.left - this.right;
        this.height = this.canvas_height - this.top  - this.bottom;

        // Change Ranges
        this.x.range([0, this.width]);
        this.y.range([this.height, 0]);
        this.xAxis.scale(this.x).tickSize(-this.height);
        if(this.id == 'context') {
            this.area.y0(this.height);
        }
        
        // Update elements
//        this.y_label.attr("y", 0)//- this.left)
//            .attr("x", 0 - (this.height / 2));
        this.plotarea.attr("transform",
                           "translate(" + this.left + "," + this.top + ")");
        this.xAxis_element
            .attr('transform', 'translate(0,' + this.height + ')')
            .call(this.xAxis);
        this.yAxis_element
            .call(this.yAxis);
        
        // Update renders?
        triggers.emit(this.id + ':render series');
    },
//    updateOptionalAttributes: function() {
//        this.area.interpolate(this.ops.shape.get());
//    },
    setShape: function() {
        this.area.interpolate(this.app.ops['View']['Shape'].get());
    },
    setContext: function () {
        this.yAxis.ticks(2);
        this.area.y0(this.height)
            .y1(this.dataValue_2_y);
        
        this.drag = d3.behavior.drag();
        this.xAxis.tickSize('auto')//TODO
        this.brush = d3.svg.brush()
            .x(this.x)
            .on("brush", triggers.emitter('chart:focus time', 'brush'));
        
        this.plotarea.append("g")
            .attr("class", "x brush")
            .call(this.brush)
            .selectAll("rect")
            .attr("y", -6)
            .attr("height", this.height + 7);
    },
    setYScale: function() {
        var scale = this.app.ops['Axes']['Y Scale'].get();
        var ticks_per_200 = 6;
        if(this.app.ops['Axes']['Y Ticks Toggle'].is(1) && this.app.ops['Axes']['Y Ticks'].get() != undefined && this.app.ops['Axes']['Y Ticks'].get() != '') {
            ticks_per_200 = this.app.ops['Axes']['Y Ticks'].get();
        } else {
            this.app.ops['Axes']['Y Ticks'].updateInInterface(ticks_per_200);
        }
        var ticks = ticks_per_200 * this.height / 200;
        this.yAxis.ticks(ticks);
        
        if(scale == 'linear') {
            this.y = d3.scale.linear()
                .range([this.height, 0]);
        } else if(scale == 'pow') {
            this.y = d3.scale.sqrt()
                .range([this.height, 0]);
        } else if(scale == 'log') {
            this.y = d3.scale.log()
                .clamp(true)
                .range([this.height, 0]);
        }
        
    },
    setYAxes: function() {
        // Set Y Scale // TODO refractor so it makes more sense
        this.setYScale();
        
        // Get Properties
        var scale = this.app.ops['Axes']['Y Scale'].get();
        var plottype = this.app.ops['View']['Plot Type'].get();
        var ymax_manual = this.app.ops['Axes']['Y Max Toggle'].is(1)
        && this.id == 'focus';
        var ymax_op = this.app.ops['Axes']['Y Max'];
        var series_plotted = this.series_arr.filter(series => series.shown);
        var sorter = this.app.legend.getSeriesSorter();
        series_plotted.sort(sorter);
        
        // Set the Y Domain
        var y_min = 0;
        if(scale == 'log') y_min = 1;

        var y_max = 100;
        var biggest_datapoint = d3.max(series_plotted.map(d => d.max));
        var highest_datapoint = series_plotted && series_plotted[0] ?
            d3.max(series_plotted[0].values.map(function (d) {
                return (d.value0 || 0) + d.value;
            })) : 100;
//        var biggest_totalpoint = 
//            d3.max(data.total_tweets.map(function (d) {
//                return d.value;
//            })); // TODO

        if(ymax_manual) {
            y_max = ymax_op.get();
        } else {
            if (plottype == 'overlap' || plottype == 'lines') {
                y_max = biggest_datapoint;

//                if(options['View']['Total Line'].is("true"))
//                    y_max = Math.max(y_max, biggest_totalpoint);
            } else if (plottype == 'percent') {
                y_max = 100;
            } else {
                y_max = highest_datapoint;
//                if(options['View']['Total Line'].is("true"))
//                    y_max = Math.max(y_max, biggest_totalpoint);
            }
            if(this.id == 'focus') {
                ymax_op.updateInInterface(y_max);
            }
        }

        this.y.domain([y_min, y_max])
            .range([this.height, 0]);
//        this.y_total_line.domain([y_min, y_max])
//            .range([this.height, 0]);

        if(scale == 'log') {
            var ticks = this.yAxis.ticks()[0];
            var log_max = Math.log(y_max) / Math.LN10;
            var tickformat = d3.format('s');
            
            // Find the y-axis scale by trying a few.
            var scales = [[], [], [], []];
            for (var e = 0; e <= Math.ceil(log_max); e++) { // For each power of 10 until the max
                if(e % 3 == 0 && Math.pow(10, e) <= y_max)
                    scales[0].push(Math.pow(10, e));
                if(Math.pow(10, e) <= y_max) {
                    scales[1].push(Math.pow(10, e));
                    scales[2].push(Math.pow(10, e));
                    scales[3].push(Math.pow(10, e));
                }
                if(Math.pow(10, e) * 2 <= y_max) {
                    scales[2].push(Math.pow(10, e) * 2);
                    scales[3].push(Math.pow(10, e) * 2);
                }
                if(Math.pow(10, e) * 3 <= y_max)
                    scales[3].push(Math.pow(10, e) * 3);
                if(Math.pow(10, e) * 4 <= y_max)
                    scales[3].push(Math.pow(10, e) * 4);
                if(Math.pow(10, e) * 5 <= y_max) {
                    scales[2].push(Math.pow(10, e) * 5);
                    scales[3].push(Math.pow(10, e) * 5);
                }
                if(Math.pow(10, e) * 6 <= y_max)
                    scales[3].push(Math.pow(10, e) * 6);
                if(Math.pow(10, e) * 7 <= y_max)
                    scales[3].push(Math.pow(10, e) * 7);
                if(Math.pow(10, e) * 8 <= y_max)
                    scales[3].push(Math.pow(10, e) * 8);
                if(Math.pow(10, e) * 9 <= y_max)
                    scales[3].push(Math.pow(10, e) * 9);
            }
            
            // Choose the scale that is closest
            if(Math.abs(scales[0].length - ticks) < Math.abs(scales[1].length - ticks)) {
                this.yAxis.tickValues(scales[0]);
            } else if(Math.abs(scales[1].length - ticks) < Math.abs(scales[2].length - ticks)) {
                this.yAxis.tickValues(scales[1]);
            } else if(Math.abs(scales[2].length - ticks) < Math.abs(scales[3].length - ticks)) {
                this.yAxis.tickValues(scales[2]);
            } else {
                this.yAxis.tickValues(scales[3]);
            }
            this.yAxis.scale(this.y).tickFormat(d3.format('s'));
            
        } else {
            this.yAxis.scale(this.y)
                .tickValues(null)
                .tickFormat(d3.format('s'));
        }
        
        // Create y Axises
        this.yAxis_element.transition().duration(1000)
            .call(this.yAxis);
    },
    setTimeWindow: function(domain) {
        this.x.domain(domain);
        this.svg.select(".x.axis")
            .call(this.xAxis);
        
        triggers.emit(this.id + ':render series', {speed: 10});
//        this.svg.selectAll("path.area")
//            .attr("d", function(d) { return this.area(d.values)});
////        this.svg.selectAll("path.area_total_line")
////            .attr("d", function(d) { return this.area_total_line(d)});
    },
    setSeries: function(arrays) {
        this.series = arrays.series;
        this.series_arr = arrays.series_arr;
        
        // TODO make timeseries based on values
        
        triggers.emit(this.id + ':place series');
    },
    placeSeries: function() {
        if(!this.series_arr || this.series_arr.length == 0) {
            this.series_objects = [];
//            console.log('placeSeries on ' + this.id + ', no series to place: ', this.series_arr);
            return;
        }
        this.setYAxes();
//        this.adjustSize();
        
        this.series_objects = this.plotarea.selectAll('g.series')
            .data(this.series_arr);
        
        // Make new paths
        this.series_objects.enter().append('g')
            .on('click', triggers.emitter('series:chart click'))
            .on('mouseover', triggers.emitter('series:chart enter'))
            .on('mousemove', function(d) {
                var xy = d3.mouse(this);
                d.cursor_xy = xy;
                triggers.emit('series:chart hover', d);
            })
            .on('mouseout', triggers.emitter('series:chart exit'));
        
        // Clear extra paths
        this.series_objects.exit().remove();
        
        this.series_objects.attr("class", function(d) {
                return "series subset_" + d.ID
            });
        
        this.paths = this.series_objects.append("path")
            .attr("class", "area");
        
        // Hide series that are not shown but exist in the background
        this.series_objects
            .style('display', subset => subset.shown ? 'block' : 'none');
        
        triggers.emit(this.id + ':render series');
    },
    renderSeries: function(args) {
        args = args || {speed: 750};
        
        if(!this.series_objects || this.series_objects.length == 0) {
            return;
        }
        
        // Define the parameters of the area
        var plottype = this.app.ops['View']['Plot Type'].get();
        if (['overlap', 'lines'].includes(plottype)) {
            this.area
                .y0(this.height)
                .y1(function (d) { return this.y(d.value); }.bind(this));
        } else {
            this.area
                .y0(function (d) { return this.y(d.value0); }.bind(this))
                .y1(function (d) { return this.y(d.value0 + d.value); }.bind(this));
        }

        // here we create the transition
        var transition = this.series_objects
            .transition()
            .duration(args.speed);

        // Transition to the new area
        var fill_opacity = plottype == 'lines'   ? 0.0 : 
                           plottype == 'overlap' ? 0.2 :
                                                   0.8 ;
        if(this.id == 'context') { // TODO quick fix
            this.series_arr.forEach(series => {
                series.stroke = '#111';
                series.fill = '#444';
            });
        }
        
        this.series_objects.classed("lines", plottype == 'lines'); // TODO
        transition.select("path.area")
            .style("fill", series => series.fill)
            .style("fill-opacity", fill_opacity)
            .style("stroke", series => series.stroke)
            .attr("d", series => series.shown ? this.area(series.values) : '');
//            .attr("d", function(d) { return this.area(d.values)}.bind(this));
    },
    customTimezone: function() {
        TS.focus.xAxis.tickFormat(d => 'Nov ' + (d.getDate() + 1));
        TS.focus.xAxis.tickValues([new Date('2014-11-13 15:00:00'), new Date('2015-11-14 15:00:00'), new Date('2015-11-15 15:00:00'), new Date('2015-11-16 15:00:00'), new Date('2015-11-17 15:00:00'), new Date('2015-11-18 15:00:00')]);
        
        TS.focus.adjustSize([100, 50]);
        TS.focus.yAxis.ticks(3);
        
        TS.focus.xAxis.tickValues([new Date('2014-12-14 17:00'), new Date('2014-12-14 23:00'), new Date('2014-12-15 05:00:00'), new Date('2014-12-15 11:00:00')]);
        TS.focus.xAxis.tickFormat(d => { var hour = d.getHours(); console.log(hour); return (hour == 17 ? 'Dec 15 12:00' : hour == 23 ? '18:00' : hour == 5 ? 'Dec 16 00:00' : '06:00')})
    },
};