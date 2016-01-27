function Legend() {
    var self = this;
    self.container = [];
    self.mouseOverToggle = false;
    self.mouseOverToggleState = true;
    
    self.key_data = [
        {term: "&nbsp;", label: "Capture Term", id: 'capture', has: false},
        {term: "&#x271d;", label: "Removed Capture Term", id: 'removed', has: false},
        {term: "*", label: "Term Added Later", id: 'added', has: false},
        {term: "R", label: "Rumor", id: 'rumor', has: false},
        {term: "<svg height=10 width=10><line x1=0 y1=10 x2=10 y2=0 class='total_line' /></svg>",
            label: "Tweet Volume", id: 'total_line', has: false}
    ];
    self.key_data_byID = self.key_data.reduce(function(all, cur) {
        all[cur.id] = cur;
        return all;
    }, {});
    self.key_data_byLabel = self.key_data.reduce(function(all, cur) {
        all[cur.label] = cur;
        return all;
    }, {});
    
    self.series_names = {
        'Tweet Type': ['original', 'retweet', 'reply', 'quote'],
        'Distinctiveness': ['distinct', 'repeat'],
        'Found In': ["Any", "Text", "Quote", "URL"],
        'Keyword': ["_total_"]
    };
    self.series_ids = {
        'Tweet Type': ['_tt_original', '_tt_retweet', '_tt_reply', '_tt_quote'],
        'Distinctiveness': ['_di_distinct', '_di_repeat'],
        'Found In': ["_fi_Any", "_fi_Text", "_fi_Quote", "_fi_URL"],
        'Keyword': ["_total_"]
    };
    self.series_names_nt = { // no total series
        'Tweet Type': ['original', 'retweet', 'reply', 'quote'],
        'Distinctiveness': ['distinct', 'repeat'],
        'Found In': ["Text", "Quote", "URL"],
        'Keyword': [],
    };
    self.series_cats = Object.keys(self.series_names);
}

Legend.prototype = {
    init: function() {
        this.container = d3.select('#legend')
            .on('mouseout', this.endToggle);
        
        this.series_cats
            .forEach(this.buildLegendSection, this);
        
        // Tooltip
        this.tooltip = this.container.append('div')
            .attr('class', 'legend_tooltip')

    },
    buildLegendSection: function(section) {
        var container = this.container.append('div')
            .attr('class', 'legend_section ' + util.simplify(section));
        
        // Header
        var legend_header = container.append('div')
            .attr('class', 'legend_header');
        
        legend_header.append('span')
            .attr('class', 'legend_title')
            .text(section)

        legend_header.append('div')
            .attr('class', 'legend_showall')
            .text('show all')
            .on('click', this.showAll);
        
        // Series
        var list = container.append('div')
            .attr('class', 'legend_series_list');
        
        if(section == 'Keyword') {            
            // Key
            this.key = container.append('div')
                .attr('id', 'legend_key');

            var legend_key_entries = this.key.selectAll('div')
                .data(legend.key_data)
                .enter().append('div')
                .attr('class', function(d) {
                    return 'legend_key_entry legend_key_' + d.id;
                });

            legend_key_entries.append('div')
                .attr('class', 'legend_key_term')
                .html(function(d) { return d.term; });

            legend_key_entries.append('div')
                .attr('class', 'legend_key_label')
                .html(function(d) { return d.label; });
        }
    },
    populate: function(section) {
        var section_div = legend.container.select('.' + util.simplify(section));
        var list_div = section_div.select('.legend_series_list');
        
        // Get series ids
        var ids = data.series_byCat[section].map(function(d) {
            return d.id;
        });    
        
        // Hide table entries
//        d3.select('#legend_key')
//            .style('display', (options.series.is('terms') ? 'table' : 'none'));
        
        // Add new entries
        var entries = list_div
            .selectAll('div.legend_entry')
            .data(ids);

        var new_entries = entries.enter().append('div')
            .attr('id', function(d) {
                return 'legend_' + d;
            })
            .attr('class', function(d) {
                return 'legend_entry ' + d;
            })
            .on('mouseover', this.hoverLegendEntry)
            .on('mousemove', this.hoverLegendEntryMove)
            .on('mouseout', this.hoverLegendEntryEnd);

        var legend_icon_divs = new_entries.append('div')
            .attr('class', 'legend_icon');
        
        legend_icon_divs.append('span')
            .attr('class', 'glyphicon')
            .on('click', function() { return false; });
        
        legend_icon_divs.append('svg')
            .attr({
                class: "legend_icon_svg",
                width: 25, height: 25
            })
            .on('mousedown', this.startToggle)
            .on('mouseover', this.hoverOverSeries)
            .on('mouseup', this.endToggle)
            .append('rect')
            .attr({
                class: "legend_icon_rect",
                x: 2.5, y: 2.5,
                rx: 5, ry: 5,
                width: 20, height: 20
            });

        new_entries.append('div')
            .attr('class', 'legend_label');
        
        new_entries.append('div')
            .attr('class', 'legend_only')
            .text('only')
            .on('click', legend.toggleSingle);

        // Remove entries
        entries.exit().remove();
        
        // Propagate data to children
        entries.each(function(d) {
            var entry = d3.select(this);
            entry.select('div.legend_icon').data([d])
                .select('svg').select('rect');
            entry.select('div.legend_label').data([d]);
            entry.select('div.legend_only').data([d]);
        });

        entries
            .attr('id', function(d) {
                return 'legend_' + d;
            })
            .attr('class', function(d) {
                return 'legend_entry ' + d;
            });
        
        list_div.on('mouseout', function(d) {
            d3.event.stopPropagation();
        });
//        legend.container.on('mouseout', legend.endToggle);
        list_div.on('mouseout', legend.endToggle);
        
        if(section == 'Keyword') {
            legend.key_data.map(function(item) {
                item.has = false;
            });

            list_div.selectAll('div.legend_label')
                .html(function (d) {
                    var series = data.series_byID[d];
                    var name = series.display_name;
                    if(options.series.is('terms')) {
                        var key_data = legend.key_data_byLabel[series.type];

                        if(key_data) {
                            name += ' ' + key_data.term;
                            key_data.has = true;
                        }
                    }
                    return name;
                });

            legend.key_data.map(function(item) {
                this.key.select('.legend_key_' + item.id)
                    .classed('hidden', !item.has);
            }, legend);
        }
        
        legend.showOrHideAll();
    },
    cmp: function(a, b) {
        if(options.series_order.is('alpha')) {
            a = a.name.toLowerCase();
            b = b.name.toLowerCase();
            
            if(a < b)
                return -1;
            else if(a > b)
                return 1;
            return 0
            
        } else if(options.series_order.is('volume')) {
            a = a.sum;
            b = b.sum;

            if(a < b)
                return 1;
            else if(a > b)
                return -1;
            return 0
        } else if(options.series_order.is('type')) {
            if((a.isKeyword && !b.isKeyword) || (a.isOldKeyword && !b.isKeyword && !b.isOldKeyword))
                return -1;
            else if((!a.isKeyword && b.isKeyword) || (!a.isOldKeyword && !a.isKeyword && b.isOldKeyword))
                return 1;
            return b.sum - a.sum;
        } else {
            a = a.order;
            b = b.order;
            
            if(a < b)
                return -1;
            else if(a > b)
                return 1;
            return 0
        }
        
    },
    cmp_byID: function(a, b) {
        a = data.series_byID[a];
        b = data.series_byID[b];
        return legend.cmp(a, b);
    },
    startToggle: function(series) {
        console.log(series);
        if(typeof(series) == "string")
            series = data.series_byID[series];
        
        legend.mouseOverToggle = true;
        legend.mouseOverToggleState = !series.shown;
        legend.toggleSeries(series); 
        d3.event.stopPropagation();
    },
    endToggle: function(series) {
        if(typeof(series) == "string")
            series = data.series_byID[series];
        
        if(legend.mouseOverToggle) {
            legend.mouseOverToggle = false;
            data.prepareData(); 
        }
    },
    highlightSeries: function(series) {
        if(typeof(series) == "string")
            series = data.series_byID[series];

        d3.selectAll('.series, .legend_icon')
            .classed('focused', false)
            .classed('unfocused', true);
        d3.selectAll('.series.' + series.id + ', .' + series.id + ' .legend_icon')
            .classed('unfocused', false)
            .classed('focused', true);
    },
    hoverLegendEntry: function(series) {
        if(typeof(series) == "string")
            series = data.series_byID[series];
        
        // Set data
        var curData = legend.tooltip.data();
        if(!curData || curData != series.id) {
            legend.tooltip.data(series.id);
            
            legend.tooltip.selectAll('*').remove();
            var rows = legend.tooltip.append('table')
                .selectAll('tr')
                .data(['total', 'max', 'type'])
                .enter()
                .append('tr');
            
            rows.append('th')
                .html(function(d) { return d + ":"; });
            
            rows.append('td')
                .html(function(d) { return series[d]; });
        }
        
        legend.tooltip.transition(200)
            .style('opacity', 1);
        
        
        legend.highlightSeries(series);
    },
    hoverLegendEntryMove: function(series) {
        legend.tooltip
            .style({
                left: d3.event.x + 20 + "px",
                top: d3.event.y + "px"
//                opacity: 1
            });
    },
    hoverLegendEntryEnd: function(series) {
        if(typeof(series) == "string")
            series = data.series_byID[series];
        
        legend.tooltip.transition(200)
            .style('opacity', 0);
        
        legend.unHighlightSeries(series);
    },
    unHighlightSeries: function(series) {
        if(typeof(series) == "string")
            series = data.series_byID[series];
        
        d3.selectAll('.series, .legend_icon')
            .classed('focused', false)
            .classed('unfocused', false);
    },
    toggleSeries: function(series) {
        if(typeof(series) == "string")
            series = data.series_byID[series];
        
        series.shown = !series.shown;
        legend.showOrHideSeries(series);
        
        if(!legend.mouseOverToggle) {
            data.prepareData();
        }
    },
    showOrHideSeries: function(series) {
        d3.select('.' + series.id + ' .legend_icon')
            .classed('off', !series.shown);
        
        if(options.legend_showhidden.is("false") && !series.shown) {
            $('.legend_entry.' + series.id).fadeOut();
        } else {
            $('.legend_entry.' + series.id).fadeIn().css('display', 'table-row');
        }
    },
    showOrHideAll: function() {
        data.series.map(legend.showOrHideSeries);
    },
    toggleSingle: function(series) {
        if(typeof(series) == "string")
            series = data.series_byID[series];
        
        data.series.map(function(inner_series) {
            inner_series.shown = false;//!turnAllOff; 
        }, this);
        
        series.shown = true;
        
        legend.showOrHideAll();

        data.prepareData();
    },
    showAll: function() {
        
        data.series.map(function(inner_series) {
            inner_series.shown = true;
        }, this);
        
        legend.showOrHideAll();

        data.prepareData();
    },
    hoverOverSeries: function(series) {
        if(typeof(series) == "string")
            series = data.series_byID[series];
        
        window.getSelection().removeAllRanges()
        if(legend.mouseOverToggle && series.shown != legend.mouseOverToggleState) {
            legend.toggleSeries(series);
        }
    }
}