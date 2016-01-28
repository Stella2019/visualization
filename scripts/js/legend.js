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
        'Tweet Type': ['tt__original', 'tt__retweet', 'tt__reply', 'tt__quote'],
        'Distinctiveness': ['di__distinct', 'di__repeat'],
        'Found In': ["fi__Any", "fi__Text", "fi__Quote", "fi__URL"],
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
    },
    buildLegendSection: function(section) {
        var container = this.container.append('div')
            .attr('class', 'legend_section ' + util.simplify(section));
        
        // Header
        var legend_header = container.append('div')
            .data([section])
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
            legend.container_keywords = list;
            
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
    populate: function(category) {
        var section_div = legend.container.select('.' + util.simplify(category));
        var list_div = section_div.select('.legend_series_list');
        
        // Get series ids
        var ids = data.series_byCat[category].map(function(d) {
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
            .on('mouseover', legend.hoverLegendEntry)
            .on('mousemove', legend.hoverLegendEntryMove)
            .on('mouseout', legend.hoverLegendEntryEnd);

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
            .on('mousedown', legend.startToggle)
            .on('mouseover', legend.hoverOverSeries)
            .on('mouseup', legend.endToggle)
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
        
//        list_div.on('mouseout', function(d) {
//            d3.event.stopPropagation();
//        });
//        legend.container.on('mouseout', legend.endToggle);
        list_div.on('mouseout', legend.endToggle);
        
        if(category == 'Keyword') {
            legend.key_data.map(function(item) {
                item.has = false;
            });

            list_div.selectAll('div.legend_label')
                .html(function (d) {
                    var series = data.series_byID[d];
                    var name = series.display_name;
                    var key_data = legend.key_data_byLabel[series.type];

                    if(key_data) {
                        name += ' ' + key_data.term;
                        key_data.has = true;
                    }
                    return name;
                });

            legend.key_data.map(function(item) {
                this.key.select('.legend_key_' + item.id)
                    .classed('hidden', !item.has);
            }, legend);
        } else {
            list_div.selectAll('div.legend_label')
                .html(function (d) {
                    var series = data.series_byID[d];
                    var name = series.display_name;
                    return name;
                });
        }
        
        legend.showOrHideAll(category);
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
        
        // Generate tooltip
        disp.tooltip.setData({
            total: series.total,
            max: series.max,
            type: series.type
        });
        disp.tooltip.on();
        
        legend.highlightSeries(series);
    },
    hoverLegendEntryMove: function(series) {
        disp.tooltip.move(d3.event.x, d3.event.y);
    },
    hoverLegendEntryEnd: function(series) {
        if(typeof(series) == "string")
            series = data.series_byID[series];
        
        disp.tooltip.off();
        
        legend.unHighlightSeries(series);
    },
    chartClickGetTweets: function(series) {
        var time = disp.getTimeHoveringOverAxis(this);

        data.getTweets({
            series: series,
            time_min: time.min,
            time_max: time.max
        });
    },
    chartHoverEnter: function(series) {
        disp.tooltip.on();
        
        legend.highlightSeries(series);
    },
    chartHoverMove: function(series) {
        disp.tooltip.move(d3.event.x, d3.event.y);
        
        var time = disp.getTimeHoveringOverAxis(this);

        var focus_column = disp.focus.svg.select('path.column_hover');
        var old_data = focus_column.data();

//      var value_i = Math.floor(xy[0] / focus.width * d.values.length);
        var value_i = data.timestamps_nested_int.indexOf(time.min.getTime());
        var value = series.values[value_i].value;
        var value0 = series.values[value_i].value0;
        
        disp.tooltip.setData({
            series: series.display_name,
            from: util.formatDate(time.min),
            to: util.formatDate(time.max),
            tweets: value,
            ' ': '<i>Click to get tweets</i>'
        });

        if(!old_data || old_data.series != series.id ||
           util.compareDates(old_data.startTime, time.min) ||
           util.compareDates(old_data.stopTime,  time.max) ) {

            focus_column.data([{
                series: series.id,
                startTime: time.min,
                stopTime: time.max,
                value: value,
                value0: value0
            }]);

            focus_column
                .transition()
                .duration(50)
                .attr("d", 
                    disp.focus.area([
                        {timestamp: time.min, value: value, value0: value0},
                        {timestamp: time.max, value: value, value0: value0}
                    ]))
                .style('display', 'block');
        }

        if(!old_data || old_data.series != series.id)
            legend.highlightSeries(series);
    },
    chartHoverEnd: function(series) {
        disp.focus.svg.select('path.column_hover')
            .style('display', 'none');
        
        disp.tooltip.off();

        legend.unHighlightSeries(series)
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
    showOrHideAll: function(category) {
        data.series_byCat[category].map(legend.showOrHideSeries);
    },
    toggleSingle: function(series) {
        if(typeof(series) == "string")
            series = data.series_byID[series];
        
        data.series_byCat[series.category].map(function(inner_series) {
            inner_series.shown = false;//!turnAllOff; 
        }, this);
        
        series.shown = true;
        
        legend.showOrHideAll(series.category);

        data.prepareData();
    },
    showAll: function(category) {
        
        data.series_byCat[category].map(function(series) {
            series.shown = true;
        }, this);
        
        legend.showOrHideAll(category);

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