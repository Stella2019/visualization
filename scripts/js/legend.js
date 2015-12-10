function Legend() {
    self = this;
    self.container = [];
    self.container_terms = [];
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
        
        this.container_terms = this.container.append('div')
            .attr('class', 'legend_part')
            .data(['legend_active']);
        
        this.container_terms.append('div')
            .attr('class', 'legend_title text-center')
            .style({'font-weight': 'bold', margin: '5px'})
            .text('Terms');
    },
    populate: function(series_data) {
        // Save data
        this.data = series_data;
        
        // Get series data
        series_data.map(function(series) {
            series.shown = true; 
        }, this);
        
        this.container_terms.select('.legend_title')
            .html(options.series.getLabel());
        
        // Add new entries
        var entries = this.container_terms
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

        entries.selectAll('div.legend_icon')
            .data(function(d) { return [d]; })
            .enter().append('div')
            .on('mousedown', this.startToggle)
//            .on('click', this.toggleSeries)
            .on('mouseover', this.hoverOverSeries)
            .on('mouseup', this.endToggle) // or container.mouseout
            .attr('class', 'legend_icon');

        entries.selectAll('div.legend_label')
            .data(function(d) { return [d]; })
            .enter().append('div')
            .attr('class', 'legend_label');

        // Remove entries
        entries.exit().remove();

        entries
            .attr('class', function(d) {
                return 'legend_entry ' + d.id;
            });
        
        this.container_terms.on('mouseout', function(d) {
            d3.event.stopPropagation();
        });
        this.container.on('mouseout', self.endToggle);

        this.container.selectAll('div.legend_icon')
            .classed('off', false);

        this.container.selectAll('div.legend_label')
            .text(function (d) {
                return d.name;
            });
    }
}