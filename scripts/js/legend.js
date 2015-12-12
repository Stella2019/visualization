function Legend() {
    self = this;
    self.container = [];
    self.container_series = [];
    self.data = [];
    self.mouseOverToggle = false;
    self.mouseOverToggleState = true;
    
    // Function
    self.startToggle = function(series) {
        self.mouseOverToggle = true;
        self.mouseOverToggleState = !series.shown;
        self.toggleSeries(series); 
        d3.event.stopPropagation();
    };
    self.endToggle = function(series) {
        if(self.mouseOverToggle) {
            self.mouseOverToggle = false;
            prepareData(); 
        }
    };
    self.highlightSeries = function(series) {
        var id;
        if((typeof series) != "string")
            id = series.id;
        else
            id = series;

        d3.selectAll('.series, .legend_icon')
            .classed('focused', false)
            .classed('unfocused', true);
        d3.selectAll('.series.' + series.id + ', .' + series.id + ' .legend_icon')
            .classed('unfocused', false)
            .classed('focused', true);
    };
    self.unHighlightSeries = function(series) {
        d3.selectAll('.series, .legend_icon')
            .classed('focused', false)
            .classed('unfocused', false);
    };
    self.toggleSeries = function(series) { //chooseKeyword
        series.shown = !series.shown;
        d3.select('.' + series.id + ' .legend_icon')
            .classed('off', !series.shown);

        if(!self.mouseOverToggle) {
            prepareData();
//            options.recordState('selection');
        }
    };
    self.hoverOverSeries = function(series) { //chooseKeyword
        if(self.mouseOverToggle && series.shown != self.mouseOverToggleState) {
            self.toggleSeries(series);
        }
    };
}

Legend.prototype = {
    init: function() {
        this.container = d3.select('#legend');
        
        this.container_series = this.container.append('div')
            .attr('class', 'legend_part')
            .data(['legend_active']);
        
        this.container_series.append('div')
            .attr('class', 'legend_title text-center')
            .style({'font-weight': 'bold', margin: '5px'})
            .text('Terms');
        
        var legend_key = this.container.append('div')
            .attr('id', 'legend_key')
            .append('dl').selectAll()
            .data([
                {term: "&nbsp;", label: "Final Capture Term"},
                {term: "&#x271d;", label: "Old Capture Term"},
                {term: "*", label: "New Term"}
            ]);
        
       legend_key.enter().insert("dt").html(function(d) { return d.term });
       legend_key.enter().insert("dd").html(function(d) { return d.label });
                    
    },
    populate: function(series_data) {
        // Save data
        this.data = series_data;
        
        // Get series data
        this.data.map(function(series) {
            series.shown = true; 
        }, this);
        
        this.container_series.select('.legend_title')
            .html(options.series.getLabel());
        d3.select('#legend_key')
            .style('display', (options.series.is('terms') ? 'block' : 'none'));
        
        // Add new entries
        var entries = this.container_series
            .selectAll('div.legend_entry')
            .data(this.data);

        entries.enter().append('div')
            .attr('id', function(d) {
                return 'legend_' + d.id;
            })
            .attr('class', function(d) {
                return 'legend_entry ' + d.id;
            })
            .on('mouseover', this.highlightSeries)
            .on('mouseout', this.unHighlightSeries);

        var legend_icons = entries.selectAll('svg.legend_icon_svg')
            .data(function(d) { return [d]; })
            .enter()
            .append('svg')
            .attr({
                class: "legend_icon_svg",
                width: 25, height: 25
            })
            .on('mousedown', this.startToggle)
            .on('mouseover', this.hoverOverSeries)
            .on('mouseup', this.endToggle)
            .append('rect')
            .attr({
                class: "legend_icon",
                x: 2.5, y: 2.5,
                rx: 5, ry: 5,
                width: 20, height: 20
            });

        entries.selectAll('div.legend_label')
            .data(function(d) { return [d]; })
            .enter().append('div')
            .attr('class', 'legend_label');

        // Remove entries
        entries.exit().remove();

        entries
            .attr('id', function(d) {
                return 'legend_' + d.id;
            })
            .attr('class', function(d) {
                return 'legend_entry ' + d.id;
            });
        
        this.container_series.on('mouseout', function(d) {
            d3.event.stopPropagation();
        });
        this.container.on('mouseout', self.endToggle);

        this.container.selectAll('div.legend_icon')
            .classed('off', false);

        this.container.selectAll('div.legend_label')
            .html(function (d) {
                var name = d.name;
                if(options.series.is('terms')) {
                    if(d.isOldKeyword)
                        name += ' &#x271d;';
                    else if(!d.isKeyword)
                        name += ' *';
                }
                return name;
            });
    }
}