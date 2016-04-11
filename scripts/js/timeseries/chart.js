function TimeseriesChart(app, id) {
    this.app = app;
    this.id = id;
    
    // Size
    this.canvas_height = 300;
    this.canvas_width = 400;
    this.top    = 20;
    this.right  = 10;
    this.bottom = 10;
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
    
    // D3 Functions
    this.area = d3.svg.area()
        .x(this.dataTimestamp_2_x);
    this.color = d3.scale.category10();
    
    // Other attributes filled during execution
    this.brush = [];
    this.drag = [];
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
        triggers.on('chart:resize', this.adjustSize.bind(this));
        triggers.on('chart:shape', this.setShape.bind(this));
        triggers.on('chart:y-scale', this.setYScale.bind(this));
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
        this.adjustSize();
    },
    buildElements: function() {
        this.svg.append("g")
            .attr("class", "plot")
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
    adjustSize: function(page_sizes) {
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
        this.yAxis.ticks(2);
        this.area.y0(this.height)
            .y1(this.dataValue_2_y);
        
        this.drag = d3.behavior.drag();
        this.xAxis.tickSize('auto')//TODO
        this.brush = d3.svg.brush()
            .x(this.x)
            .on("brush", function() { disp.setFocusTime('brush'); } ); // TODO
    },
    setYScale: function() {
        var focus = this.focus;
        var scale = this.app.ops['View']['Y Scale'];
        if(scale == 'linear') {
            focus.y = d3.scale.linear()
                .range([focus.height, 0]);
            focus.y_total_line = d3.scale.linear()
                .range([focus.height, 0]);
            focus.yAxis.scale(focus.y)
                .tickFormat(null);
        } else if(scale == 'pow') {
            focus.y = d3.scale.sqrt()
                .range([focus.height, 0]);
            focus.y_total_line = d3.scale.sqrt()
                .range([focus.height, 0]);
            focus.yAxis.scale(focus.y)
                .tickFormat(null);
        } else if(scale == 'log') {
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
};