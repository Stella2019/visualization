function TimeseriesChart(app, id) {
    this.app = app;
    this.id = id;
    
    // Size
    this.canvas_height = 300;
    this.canvas_width = 400;
    this.top    = 20;
    this.right  = 20;
    this.bottom = 20;
    this.left   = 20;
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
    
    // Area
    this.area = d3.svg.area()
        .x(this.dataTimestamp_2_x);
    
    // Other attributes filled during execution
    this.brush = [];
    this.svg = [];
    this.container = [];
    this.y_label = [];
    this.column_hover = [];
    
    this.init();
}

TimeseriesChart.prototype = {
    init: function() {
        this.setTriggers();
    },
    setTriggers: function() {
        triggers.on('page_built', this.build.bind(this));
        triggers.on('resized', this.adjustSize.bind(this));
        triggers.on('chart:shape:set', this.setShape.bind(this));
    },
    build: function() {
        this.container = d3.select('#' + this.id + '-container');
        this.svg = d3.select('#' + this.id);
        this.buildElements();
        this.adjustSize();
        this.setShape();
        
        if(this.id == 'context') {
            this.setContext();
        }
        // disp.setColorScale
    },
    buildElements: function() {
        this.svg.append("g")
            .attr("class", "focus")
            .attr("transform", "translate(" + this.left + "," + this.top + ")");
        
//        this.y_label = this.svg.append("text")
//            .attr('class', 'y_label')
//            .attr("y", 0 - this.left)
//            .attr("x", 0 - (this.height / 2))
//            .attr("dy", "1em")
//            .text("Count of <Subset> Tweets Every <Resolution>");

        this.column_highlight = this.svg.append("path")
            .attr('class', 'column_highlight');
        
        this.xAxis_element = this.svg.append('g').attr('class', 'xAxis');
        this.xAxis_element.attr('class','x axis')
            .attr('transform', 'translate(0,' + this.height + ')')
            .transition().duration(1000)
            .call(this.xAxis); 
    },
    adjustSize: function(args) {
        // Recompute width and height
        this.canvas_width  = parseInt(this.container.style('width'));
        this.canvas_height = parseInt(this.container.style('height'));
        this.svg.style({
            height: this.canvas_height, 
            width: this.canvas_width, 
        })
        this.width  = this.canvas_width  - this.left - this.right;
        this.height = this.canvas_height - this.top  - this.bottom;
        
        // Change Ranges
        this.x.range([0, this.width]);
        this.y.range([this.height, 0]);
        this.xAxis.scale(this.x).tickSize(-this.height)
        this.area.y0(this.height)
        
        // Update elements
//        this.y_label.attr("y", 0)//- this.left)
//            .attr("x", 0 - (this.height / 2));
        this.xAxis_element
            .attr('transform', 'translate(0,' + this.height + ')')
            .call(this.xAxis);
        
        // Update renders
        // TODO
    },
//    updateOptionalAttributes: function() {
//        this.area.interpolate(this.ops.shape.get());
//    },
    setShape: function() {
        this.area.interpolate(this.app.ops['View']['Shape'].get());
    },
    setContext: function () {
        this.area.y1(this.dataValue_2_y);
        
        this.brush = d3.svg.brush()
            .x(this.x)
            .on("brush", function() { disp.setFocusTime('brush'); } );
    },
    setYScale: function() {
        var focus = this.focus;
        
        if(options['View']['Y Scale'].is("linear")) {
            focus.y = d3.scale.linear()
                .range([focus.height, 0]);
            focus.y_total_line = d3.scale.linear()
                .range([focus.height, 0]);
            focus.yAxis.scale(focus.y)
                .tickFormat(null);
        } else if(options['View']['Y Scale'].is("pow")) {
            focus.y = d3.scale.sqrt()
                .range([focus.height, 0]);
            focus.y_total_line = d3.scale.sqrt()
                .range([focus.height, 0]);
            focus.yAxis.scale(focus.y)
                .tickFormat(null);
        } else if(options['View']['Y Scale'].is("log")) {
            focus.y = d3.scale.log()
                .clamp(true)
                .range([focus.height, 0]);
            focus.y_total_line = d3.scale.log()
                .clamp(true)
                .range([focus.height, 0]);
            focus.yAxis.scale(focus.y)
                .tickFormat(focus.y.tickFormat(10, ",.0f"));
        }
    },
};