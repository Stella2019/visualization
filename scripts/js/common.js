global_min_id = 0;
global_max_id = 1e20;

var util = {
    formatDate: d3.time.format("%Y-%m-%d %H:%M:%S"),
    formDate: function(d) { return util.formatDate(new Date(new Date(new Date(d).setSeconds(0)).setMilliseconds(0))).replace(' ', 'T'); },
    date2monthstr: d3.time.format("%Y-%m"),
    date: function(str) {
        return util.formatDate.parse(str);
    },
    simplify: function(str) {
        return "l" + str.replace(/\W/g, '_');
    },
    compareCollections: function(a, b) {
        return util.compareDates(new Date(a.StartTime), new Date(b.StartTime));
    },
    compareSeries: function(a, b) {
        if(a.sum !== undefined && b.sum !== undefined)
            return b.sum - a.sum;
        return a.order - b.order;
    },
    compareDates: function(a, b) {
        if(a < b) 
            return -1;
        if(a > b)
            return 1;
        return 0;
    },
    lunique: function(list) {
        return Array.from(new Set(list)).sort();
    },
    range: function(length) {
        var arr = [];
        for(var i = 0; i < length; i++) {
            arr.push(i);
        }
        return arr;
    },
    zeros: function(length, width) { // just initialize a 1D or 2D matrix filled with zeros like in Matlab
        if(!width) {
            return d3.range(length).map(function() { return 0; });
        } else {
            return d3.range(length).map(function() { 
                return d3.range(width).map(function() { return 0; });
            });
        }
    },
    lshift: function(num, bits) {
        return num * Math.pow(2, bits);
    },
    rshift: function(num, bits) {
        return num / Math.pow(2, bits);
    },
    twitterID2Timestamp: function(ID) {
        return new Date(util.rshift(ID, 22) + 1288834974657);
    },
    timestamp2TwitterID: function(date) {
        return util.lshift(date.getTime() - 1288834974657, 22);
    },
    formatThousands: function(value) {
        var res = '';
        for (var i = Math.floor(Math.log10(value)); i >= 0; i--) {
            res += Math.floor(value / Math.pow(10, i));
            if(i % 3 == 0 && i != 0)
                res += ' ';
            value = value % Math.pow(10, i);
        }
        return res;
    },
    formatMinutes: function(value) {
        var days = Math.floor(value / 60 / 24);
        var hours = Math.floor(value / 60) % 24;
        var minutes = value % 60;
        if(days) return days + 'd ' + (hours < 10 ? '0' : '') + hours + 'h ' + (minutes < 10 ? '0' : '') + minutes + 'm&nbsp;';
        if(hours) return hours + 'h ' + (minutes < 10 ? '0' : '') + minutes + 'm&nbsp;';
        return minutes + 'm&nbsp;';
    },
}

function Counter() {
    this.counts = new d3.map();
}
Counter.prototype = {
    has: function(key) {
        return this.counts.get(key) || false;
    },
    set: function(key, val) {
        this.counts.set(key, val);
    },
    incr: function(key, add) {
        add = add || 1;
        var val = this.counts.get(key) || 0;
        this.counts.set(key, val + add);
    },
    cmpCount: function(a, b) {
        if(a.value == b.value)
            return a.key.localeCompare(b.key);
        return b.value - a.value
    },
    top: function(k) {
        return this.top_nlogn(k);
    },
    top_nk: function(k) { // O(nk)
        k = k || 10; // default 10
        
        var top = d3.range(k).map(function() {
            return {key: "", value: 0};
        })
        var minVal = 0;
        var moreThanMin = 0;
        this.counts.forEach(function(key, val) {
            // If it is bigger than a candidate
            if(minVal < val) {
                if(moreThanMin >= k - 1)
                    top = top.filter(function(d) { return d.value > minVal});
                top.push({
                    key: key,
                    value: val
                });
                minVal = d3.min(top, function(d) { return d.value});
                moreThanMin = top.filter(function(d) { return d.value > minVal}).length;
            } else if(minVal == val) {
                top.push({
                    key: key,
                    value: val
                });
            }
        });
        
        return this.firstK(this.getSorted(top), k)
    },
    top_nlogn: function(k) { // O(nlogn)
        k |= 10; // default 10
        
        return this.firstK(this.getSorted(), k);
    },
    stopwords: ['the', 'a', 'an', 'that', 'this',
                'rt', 
                'in', 'on', 'to', 'of', 'at', 'for', 'with', 'about',
                'is', 'are', 'be', 'was', 'have', 'has',
                'i', 'you', 'he', 'she', 'it', 'we', 'they',
                'me', 'him', 'her', 'us', 'them', 
                'my', 'your', 'his', 'its', 'our', 'their',
                'and', 'or',
                'as', 'if', 'so'],
    top_no_stopwords: function(k) {
        k |= 10; // default 10
        var stopwords = this.stopwords;
        
        var entries = this.counts.entries().filter(function(d) {
            return !d.key.split(' ').reduce(function(found, word) {
                return found || stopwords.includes(word);
            }, false);
        }, this);
        return this.firstK(this.getSorted(entries), k)
    },
    getSorted: function(arr) {
        if(!arr)
            arr = this.counts.entries();
        arr.sort(this.cmpCount)
        return arr;
    },
    firstK: function(arr, k) {
        if(!arr)
            arr = this.counts.entries();
        k |= 10; // default 10
        k = Math.min(k, arr.length);
        
        var res = [];
        for(var i = 0; i < k; i++)
            res.push(arr[i]);
        return res;
    },
    purgeBelow: function(minimum, add_rare) { 
        if(minimum) {
            var self = this;
            this.counts.forEach(function(key, val) {
                if(val < minimum) {
                    this.remove(key);
                    if(add_rare)
                        self.incr("_rare_", val);
                }
            });
        } else { // Halves the size of the array
            var sorted = this.getSorted();
            minimum = sorted[sorted.length / 2].value + 1;

            sorted.forEach(function(entry) {
                if(entry.value < minimum) {
                    this.counts.remove(entry.key);
                    if(add_rare)
                        this.incr("_rare_", entry.value);
                }
            }, this);
        }
    }
};

function Connection(args) {
    var permitted_args = ['name', 'url', 'post', 'time_res',
                          'progress_div', 'progress_text', 'progress_full',
                          'tweet_min', 'tweet_max',
                          'failure_msg',
                          'on_chunk_finish', 'on_finish']

    // Save args  
    if(args) {
        Object.keys(args).forEach(function (item) {
            if(permitted_args.includes(item)) {
                this[item] = args[item];
            }
        }, this);
    }
    
    // Defaults
    this.name            = this.name            || 'r' + Math.floor(Math.random() * 1000000 + 1);
    this.url             = this.url             || "";
    this.post            = this.post            || {};
    this.time_res        = this.time_res        || 1; // 1 Hour
    
    this.progress        = {};
    this.progress_div    = this.progress_div    || '#timeseries_div';
    this.progress_text   = this.progress_text   || "Working";
    this.progress_full   = this.progress_full   || false;
    
    this.tweet_chunks    = [];
    this.chunk_index     = 0;
    this.tweet_min       = this.tweet_min          || 0; // TODO
    this.tweet_max       = this.tweet_max          || 1e20; // TODO
    
    this.failure_msg     = this.failure_msg     || 'Problem with data stream';
    this.on_chunk_finish = this.on_chunk_finish || function () {};
    this.on_finish       = this.on_finish       || function () {};
    
}
Connection.prototype = {
    php: function(url, fields, callback, error_callback) {
        if(!fields)
            fields = {};
        if(!callback)
            callback = function() {};
        if(!error_callback)
            error_callback = function() {};
        
        $.ajax({
            url: 'scripts/php/' + url + '.php',
            type: "POST",
            data: fields,
            cache: false,
            success: callback,
            error: error_callback
        });
    },
    startStream: function () {
        this.tweet_chunks = [];
        this.chunk_index = 0;
        var tweet_min = this.tweet_min - (this.tweet_min % util.lshift(60 * 1000, 22)) + 22410166272; // Round to the nearest minute
        for(var tweet = tweet_min; tweet <= this.tweet_max;
            tweet += util.lshift(this.time_res * 60 * 60 * 1000, 22)) {
            this.tweet_chunks.push(tweet);
        }
        this.tweet_chunks.push(this.tweet_max);

        // Start progress bar
        this.progress = new Progress({
            name:      this.name,
            parent_id: this.progress_div,
            full:      this.progress_full,
            text:      this.progress_text,
            steps:     this.tweet_chunks.length - 1
        });
        this.progress.start();

        this.startChunk();
    },
    startChunk: function () {
        // If we are at the max, end
        if (this.chunk_index >= this.tweet_chunks.length - 1) {
            // Load the new data
            this.on_finish();

            // End the progress bar and stop function
            this.progress.end();
            return;
        } else if(this.chunk_index < 0) {
            // End prematurely
            this.progress.end();
            return;
        }

        this.post.tweet_min = this.tweet_chunks[this.chunk_index];
        this.post.tweet_max = this.tweet_chunks[this.chunk_index + 1];

        this.php(this.url, this.post,
                     this.chunk_success.bind(this),
                     this.chunk_failure.bind(this));
    },
    chunk_success: function (file_data) {
        if (file_data.includes('<b>Notice</b>') || file_data.includes('<b>Error</b>')) {
            console.debug(file_data);

            // Abort
            this.chunk_failure();
            return;
        }

        // Update the progress bar
        this.progress.update(this.chunk_index + 1, this.progress_text);

        this.on_chunk_finish(file_data);

        // Start loading the next batch
        this.chunk_index = this.chunk_index + 1;
        this.startChunk();
    },
    chunk_failure: function (a, b, c) {
        console.log(a, b, c);
        disp.alert(this.failure_msg);
        this.progress.end();
    },
    stop: function() {
        this.chunk_index = -100;
    }
};

function Tooltip() {
    this.div = {};
    this.info = {};
}
Tooltip.prototype = {
    init: function() {
        this.div = d3.select('#body')
            .append('div')
            .attr('class', 'tooltip');
    },
    setData: function(new_data) {
        if(JSON.stringify(this.data) != JSON.stringify(new_data)) {
            // Clear & set new parameters
            this.data = new_data;
            this.div.selectAll('*').remove();

            // Create table
            var rows = this.div.append('table')
                .selectAll('tr')
                .data(Object.keys(new_data))
                .enter()
                .append('tr');

            rows.append('th')
                .html(function(d) { return d + ":"; });

            rows.append('td')
                .html(function(d) { 
                    if(Array.isArray(new_data[d]))
                        return new_data[d].join(', ');
                    return new_data[d];
                });
        }
    },
    on: function() {
        this.div
            .transition(200)
            .style('opacity', 1);
    },
    move: function(x, y) {
        var height = parseInt(this.div.style('height'));
        var pageHeight = document.documentElement.clientHeight;
        if(y + height > pageHeight) {
            y += pageHeight - (y + height)
        }
        
        this.div
            .style({
                left: x + 20 + "px",
                top: y + "px"
            });
    },
    off: function() {
        this.div
            .transition(200)
            .style('opacity', 0);
    },
    attach: function(id, data_transform) {
        d3.selectAll(id)
            .on('mouseover', function(d) {
                this.setData(data_transform(d))
                this.on();
            }.bind(this))
            .on('mousemove', function(d) {
                this.move(d3.event.x, d3.event.y);
            }.bind(this))
            .on('mouseout', function(d) {
                this.off();
            }.bind(this));
    }
};

triggers = {
    events: {},
    on: function (eventName, fn) {
        this.events[eventName] = this.events[eventName] || [];
        this.events[eventName].push(fn);
    },
    off: function(eventName, fn) {
        if (this.events[eventName]) {
            for (var i = 0; i < this.events[eventName].length; i++) {
                if (this.events[eventName][i] === fn) {
                    this.events[eventName].splice(i, 1);
                    break;
                }
            };
        }
    },
    emit: function (eventName, data) {
        if (this.events[eventName]) {
            this.events[eventName].forEach(function(fn) {
                fn(data);
            });
        }
    },
    emitter: function(eventName) {
        return function(d) { this.emit(eventName, d); }.bind(this);
    }
};

function Progress(args) {
    // Grab parameters
    var valid_param = ['name', 'parent_id', 'full', 'text', 'steps', 'initial'];
    Object.keys(args).forEach(function (item) {
        if(valid_param.includes(item)) {
            this[item] = args[item];
        }
    }, this);
    
    // Set defaults if they aren't already set
    this.name      = this.name      || "progress bar";
    this.parent_id = this.parent_id || "#timeseries_div";
    this.full      = this.full      || false;
    this.text      = this.text      || "Working";
    this.steps     = this.steps     || 100;
    this.initial   = this.initial   || 0;
    
    // Make holding containers
    this.container_div = '';
    this.bar_div       = '';
    this.active        = false;
    
    // Set styles
    this.bar_style = {
        'width': '0%',
        'font-weight': 'bold',
        'padding': '10px 0px',
        'font-size': '1em',
        'text-align': 'center',
        'white-space': 'nowrap',
    };
    if(this.full) {
        this.container_style = {
            position: 'absolute',
            top: '0px',
            left: '0px',
            width: '100%',
            height: '100%',
            opacity: 0.75,
            background: 'grey',
            'z-index': 3
        }
        this.bar_style.padding = '5px 0px';
    } else {
        this.container_style = {
            position: 'absolute',
            top: '36%',
            left: '10%',
            width: '80%',
            height: '40px',
            background: '#ccc',
            'z-index': 3
        };
    }
}
Progress.prototype = {
    start: function() {        
        // Start progress bar
        this.container_div = d3.select(this.parent_id)
            .append('div')
            .attr('id', this.name + '_progress_div')
            .attr('class', 'progress')
            .style(this.container_style);
        
        this.bar_div = this.container_div
            .append('div')
            .attr({
                id: this.name + "_progress",
                class: "progress-bar progress-bar-striped active",
                role: "progressbar",
                'aria-valuenow': "0",
                'aria-valuemin': "0",
                'aria-valuemax': "100",
                'transition': "width .1s ease"
            })
            .style(this.bar_style)
            .text(this.text);
        
        this.active = true;
        this.update(this.initial, this.text);
    },
    update: function(step, text) {
        var percentDone =  Math.floor(step * 100 / this.steps);
        this.text = text || this.text;
        
        this.bar_div
            .attr('aria-valuenow', percentDone + "")
            .style('width', percentDone + "%")
            .text(this.text);
    },
    end: function() {
        if(this.active) {
            this.container_div.remove();
            this.active = false;
        } else {
            // Nothing, it's already gone
        }
    },
};