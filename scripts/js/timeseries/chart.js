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
    this.x = d3.time.scale().range([0, this.width]);
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
    this.color = d3.scale.category10();
    
    // Other attributes filled during execution
    this.brush = [];
    this.drag = [];
    this.svg = [];
    this.plotarea = [];
    this.container = [];
    this.y_label = [];
    this.column_hover = [];
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
        triggers.on('chart:resize', this.adjustSize.bind(this));
        triggers.on('chart:shape', this.setShape.bind(this));
        triggers.on('chart:y-scale', this.setYScale.bind(this));
        
        triggers.on(this.id + ':set series', this.setSeries.bind(this));
        triggers.on(this.id + ':place series', this.placeSeries.bind(this));
        triggers.on(this.id + ':render series', this.renderSeries.bind(this));
    },
    build: function() {
        this.container = d3.select('#' + this.id + '-container');
        this.svg = d3.select('#' + this.id);
        this.buildElements();
        this.setShape();
        if(this.id == 'context') {
            this.setContext();
        }
        this.setColorScale();
        
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
    adjustSize: function(page_sizes) {
        if(!this.container || this.container.length == 0) {
            return;
        }
        if(!page_sizes) {
            throw Error();
        }
        
        // Recompute width and height
        this.canvas_width  = parseInt(this.container.style('width'));
        this.canvas_height = page_sizes ? page_sizes[this.id == 'context' ? 1 : 0] : 200;
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
        
//        console.log('size', this.height, this.width, this.canvas_width, this.canvas_height);
        // TODO
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
        var scale = this.app.ops['View']['Y Scale'];
        if(scale == 'linear') {
            this.y = d3.scale.linear()
                .range([this.height, 0]);
            this.yAxis.scale(this.y)
                .tickFormat(null);
        } else if(scale == 'pow') {
            this.y = d3.scale.sqrt()
                .range([this.height, 0]);
            this.yAxis.scale(this.y)
                .tickFormat(null);
        } else if(scale == 'log') {
            this.y = d3.scale.log()
                .clamp(true)
                .range([this.height, 0]);
            this.yAxis.scale(this.y)
                .tickFormat(this.y.tickFormat(10, ",.0f"));
        }
    },
    setYAxes: function() {
        // Get Properties
        var scale = this.app.ops['View']['Y Scale'].get();
        var plottype = this.app.ops['View']['Plot Type'].get();
        var ymax_manual = this.app.ops['View']['Y Max'].is('true');
        var ymax_op = this.app.ops['View']['Y Max'];
        
        // Set the Y Domain
        var y_min = 0;
        if(scale == 'log') y_min = 1;

        var y_max = 100;
        var biggest_datapoint = d3.max(this.series_arr.map(function (d) {
                return d.max;
            }));
        var highest_datapoint = // because of stacked data
            d3.max(this.series_arr[0].values.map(function (d) {
                return (d.value0 || 0) + d.value;
            }));
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
            ymax_op.updateInInterface(y_max);
        }

        this.y.domain([y_min, y_max])
            .range([this.height, 0]);
//        this.y_total_line.domain([y_min, y_max])
//            .range([this.height, 0]);

        if(scale == 'log') {
            this.yAxis.scale(this.y)
                .tickFormat(this.y.tickFormat(10, ",.0f"));
        }
        
        // Create y Axises
        this.yAxis_element.transition().duration(1000)
            .call(this.yAxis);
    },
    setColorScale: function() {
//        this.typeColor = d3.scale.category20c();
        this.typeColor = d3.scale.ordinal()
//            .range(["#AAA", "#CCC", "#999", "#BBB"]);
            .range(["#CCC"]);
        
        
        switch(this.app.ops['View']['Color Scale'].get()) {
            case "category10":
                this.color = d3.scale.category10();
                break;
            case "category20":
                this.color = d3.scale.category20();
                break;
            case "category20b":
                this.color = d3.scale.category20b();
                break;
            case "category20c":
                this.color = d3.scale.category20c();
                break;
            default:
                this.color = d3.scale.category10();
                break;
        }
    },
    setSeries: function(arrays) {
        this.series = arrays.series;
        this.series_arr = arrays.series_arr;
    },
    placeSeries: function() {
        this.setYAxes();
//        this.adjustSize();
//        if(!this.series_arr || this.series_arr.length == 0) {
//            this.series_objects = [];
//            return;
//        }
        
        this.series_objects = this.plotarea.selectAll('g.series')
            .data(this.series_arr);
        
        // Make new paths
        this.series_objects.enter().append('g')
//            .on("click", legend.chartClickGetTweets) // TODO
//            .on("mouseover", legend.chartHoverEnter) // TODO
//            .on("mousemove", legend.chartHoverMove) // TODO
//            .on("mouseout", legend.chartHoverEnd); // TODO
        
        // Clear extra paths
        this.series_objects.exit().remove();
        
        this.series_objects.attr("class", function(d) {
                return "series series_" + d.id
            });
        
        this.paths = this.series_objects.append("path")
            .attr("class", "area");
        
        triggers.emit('context:render series');
    },
    renderSeries: function() {
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
        var transition = //this.series_objects
            this.svg.selectAll('.series')
            .transition()
            .duration(750);

        // Transition to the new area
        var fill_opacity = plottype == 'lines'   ? 0.0 : 
                           plottype == 'overlap' ? 0.1 :
                                                   0.8 ;

//        this.series_objects.classed("lines", false); // TODO
        transition.select("path.area")
            .style("fill", function (d) { return d.fill; })
            .style("fill-opacity", fill_opacity)
            .style("stroke", function (d) { return d.stroke; })
            .attr("d", function(d) { return this.area(d.values)}.bind(this));
    }
};