var FD;

function FeatureDistribution() {
    this.connection = new Connection();
    this.ops = new Options(this);
    this.modal = new Modal(this);
    this.tooltip = new Tooltip();
    this.dataset = new CollectionManager(this, {
        name: 'Dataset', 
        flag_subset_menu: true,
        flag_secondary_event: true,
        flag_time_window: false,
        flag_allow_edits: false
    });
    
    this.data = {};
    
    this.feats = {
        counter: ['Text', 'TextStripped', 'TextUnigrams', 'TextBigrams', 'TextTrigrams', 'TextCooccur', 'ExpandedURL', 'ExpandedURL Domain', 'MediaURL', 'Lang', 'Timestamp', 'Type', 'Distinct', 'Source', 'ParentID', 'UserID', 'Username', 'Screenname', 'UserCreatedAt', 'UserDescription Unigrams', 'UserLocation', 'UserUTCOffset', 'UserTimezone', 'UserLang', 'UserVerified', 'UserStatusesCount', 'UserFollowersCount', 'UserFriendsCount', 'UserListedCount', 'UserFavouritesCount'],
        shown: ['Text', 'TextStripped', 'TextUnigrams', 'TextBigrams', 'TextTrigrams', 'TextCooccur', 'ExpandedURL', 'ExpandedURL Domain', 'MediaURL', 'Lang', 'Timestamp', 'Type', 'Distinct', 'Source', 'ParentID', 'UserID', 'Username', 'Screenname', 'UserCreatedAt', 'UserDescription Unigrams', 'UserLocation', 'UserUTCOffset', 'UserTimezone', 'UserLang', 'UserVerified', 'UserStatusesCount', 'UserFollowersCount', 'UserFriendsCount', 'UserListedCount', 'UserFavouritesCount'],
        simple: ['Text', 'TextStripped', 'Type', 'Distinct', 'Source', 'ParentID', 'UserID', 'Username', 'Screenname', 'UserLocation', 'UserUTCOffset', 'UserTimezone',  'UserVerified'],
        time: ['Timestamp', 'UserCreatedAt'],
        link: ['ExpandedURL', 'ExpandedURL Domain', 'MediaURL'],
        quantity: ['UserStatusesCount', 'UserFollowersCount', 'UserFriendsCount', 'UserListedCount', 'UserFavouritesCount'],
        nominal: ['Text', 'TextStripped', 'TextUnigrams', 'TextBigrams', 'TextTrigrams', 'TextCooccur', 'ExpandedURL', 'ExpandedURL Domain', 'MediaURL', 'Lang', 'Timestamp', 'Type', 'Distinct', 'Source', 'ParentID', 'UserID', 'Username', 'Screenname', 'UserCreatedAt', 'UserDescription Unigrams', 'UserLocation', 'UserUTCOffset', 'UserTimezone', 'UserLang', 'UserVerified'],
        hasStopwords: ['TextUnigrams', 'TextBigrams', 'TextTrigrams', 'TextCooccur', 'UserDescription Unigrams'],
        lang: ['Lang', 'UserLang'],
        user: [],
    }
    
    // Page Objects
    this.body = [];
}
FeatureDistribution.prototype = {
    init: function() {
        this.setTriggers();
        this.buildPage();
        this.setOptions();
        
        this.tooltip.init();
        triggers.emit('modal:build');
        triggers.emit('collectionManager:build');
        
//        this.getEventData();
        
        setTimeout(triggers.emitter('tweets:fetch'), 1000);
    },
    setTriggers: function() {
        
        triggers.on('event:set', this.loadTweets.bind(this, 'event'));
        triggers.on('subset:set', this.loadTweets.bind(this, 'subset'));
        
        triggers.on('event2:set', this.loadTweets.bind(this, 'event2'));
        triggers.on('subset2:set', this.loadTweets.bind(this, 'subset2'));
        
        triggers.on('counters:count', this.countFeatures.bind(this));
        triggers.on('counters:show', this.showCounts.bind(this));
    },
    buildPage: function() {
        this.body = d3.select('body').append('div')
            .attr('id', 'body');
        
        var description_box = this.body.append('div')
            .attr('class', 'descriptions');
        
        this.desc_a = description_box.append('div')
            .attr('class', 'description');
        this.desc_b = description_box.append('div')
            .attr('class', 'description');
    },
    setOptions: function() {
        this.ops.panels = ['Dataset', 'Download', 'Display'];
        
        this.ops['Dataset'] = {};
        this.ops['Download'] = {
            Limit: new Option({
                title: 'Tweet Limit',
                labels: ['100', '1 000', '10 000', '100 000', '1 000 000', '10 000 000', 'All'],
                ids: [1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e10],
                isnumeric: true
            }),
            'Chunk Size': new Option({
                title: 'Tweets per Chunk',
                labels: ['10', '100', '1 000', '10 000', '100 000'],
                ids:    [ 1e1,   1e2,     1e3,      1e4,       1e5],
                isnumeric: true
            })
        };
        this.ops['Display'] = {
            TopX: new Option({
                title: "Top",
                labels: ['10', '20', '100', '200', '1000'],
                ids:    ['10', '20', '100', '200', '1000'],
                default: 1,
                callback: triggers.emitter('counters:show')
            }),
            Filter: new Option({
                title: "Filter",
                labels: ['None', 'Redundant Tweets'],
                ids:    ['none', 'redun'],
                default: 1,
                callback: triggers.emitter('counters:count')
            }),
            'Exclude Stopwords': new Option({
                title: "Stopwords",
                styles: ["btn btn-sm btn-default", "btn btn-sm"],
                labels: ["Include",
                         "Exclude"],
                ids:    ['false', 'true'],
                default: 1,
                type: 'toggle',
                callback: triggers.emitter('counters:show')
            }),
            'Count Quantity': new Option({
                title: 'Count Quantity',
                labels: ['Count', 'Percent'],
                ids: ['freq', 'percent'],
                callback: triggers.emitter('counters:show')
            }),
            'Cmp Quantity': new Option({
                title: 'Cmp Quantity',
                labels: ['Ratio', 'Log Ratio'],
                ids: ['ratio', 'log-ratio'],
                callback: triggers.emitter('counters:show')
            }),
            'Order': new Option({
                title: 'Order by',
                labels: ['Token', 'Freq A', 'Freq B', 'A / B', 'B / A'],
                ids: ['Token', 'Frequency', 'Frequency B', 'Ratio', '-Ratio'],
                default: 1,
                callback: triggers.emitter('counters:show')
            }),
//            TF: new Option({
//                title: "Term Frequency",
//                labels: ['&sum; Has', '&sum; Count'],
//                ids:    ['has', 'count'],
//                default: 0,
////                breakbefore: true,
//                callback: triggers.emitter('counters:show')
//            }),
//            'TF Modifier': new Option({
//                title: "TF Modifier",
//                labels: ['Raw', 'Fraction', 'Percent', 'Log'],
//                ids:    ['raw', 'fraction', 'percent', 'log'],
//                default: 0,
//                callback: triggers.emitter('counters:show')
//            }),
//            DF: new Option({
//                title: "Doc Frequency",
//                labels: ['None', '&sum; Has', '&sum; Count'],
//                ids:    ['none', 'has', 'count'],
//                default: 0,
//                breakbefore: true,
//                callback: triggers.emitter('counters:show')
//            }),
//            'IDF': new Option({
//                title: "Inverse",
//                labels: ['1 / DF', '#Docs / DF', 'Log(#Docs / DF)'],
//                ids:    ['inv', 'ratio', 'log-ratio'],
//                default: 0,
//                callback: triggers.emitter('counters:count')
//            }),
        };
        
        this.ops.init();
    },
    loadTweets: function(collection) {
        var cmp = collection.includes('2');
        var collection_type = cmp ? collection.slice(0, -1) : collection;
        var collection_id = this.dataset[collection] ? this.dataset[collection].ID : undefined;
        if(!collection_id) {
            return;
        }
        
        // Initialize the data storage
        var setname = collection_type + collection_id;
        var data = {};
        var lastTweet = 0;
        if(!(setname in this.data)) {
            data = {
                collection: collection_type,
                id: collection_id,
                tweets: {},
                tweets_arr: [],
                counted: 0
            };
            if(collection_type == 'subset') {
                data.subset = this.dataset['subsets'][data.id];
                data.event = this.dataset['events'][data.subset.Event];
                data.label = (data.event.DisplayName || data.event.Name) + ' - ' + data.subset.Feature + ' - ' + data.subset.Match;
            } else {
                data.event = this.dataset['events'][data.id];
                data.label = data.event.DisplayName || data.event.Name;
            }
            this.data[setname] = data;
        } else {
            // Start where we left off
            data = this.data[setname];
            lastTweet = new BigNumber(data.tweets_arr[data.tweets_arr.length - 1].ID);
        }
        
        // Initialize the connection
        data.tweet_connection = new Connection({
            url: 'tweets/get',
            post: {
                collection: collection_type,
                collection_id: collection_id
            },
            quantity: 'count',
            resolution: this.ops['Download']['Chunk Size'].get(),
            max: this.ops['Download']['Limit'].get(),
            on_chunk_finish: this.parseNewTweets.bind(this, setname),
//            on_finish: triggers.emitter('counters:count', setname),
        });
        if(lastTweet) {
            data.tweet_connection['lastTweet'] = lastTweet;
        }
        
        // Start the connection
        data.tweet_connection.startStream();
    },
    parseNewTweets: function(setname, file_data) {
        var newTweets;
        try {
            newTweets = JSON.parse(file_data);
        } catch(err) {
            console.error(file_data);
            return;
        }
    
        // Add information to the tweets
        newTweets.forEach(function(tweet) {
            if(!(tweet.ID in this.data[setname].tweets)) {
                this.data[setname].tweets[tweet.ID] = tweet;
                this.data[setname].tweets_arr.push(tweet);
            }
        }, this);
        
        console.log(setname + ': ' + util.formatThousands(this.data[setname].tweets_arr.length) + ' Tweets');
        triggers.emit('counters:count', setname);
    },
    countFeatures: function(setname) {
        var set = this.data[setname];
        
        // Remake counting attributes if they haven't been counted yet
        if(!set.counted || set.counted == set.tweets_arr.length) {
            set.counted = 0;
            set.nTweets = 0;

            // Start Counters        
            set.counter = {};
            this.feats.counter.forEach(function(counter) {
                set.counter[counter] = new Counter();
            });
            
        }
        
        // Add up ngrams
        var repeatTextOK = this.ops['Display']['Filter'].is('none');
        for(; set.counted < set.tweets_arr.length; set.counted++) {
            var tweet = set.tweets_arr[set.counted];
            set.nTweets += 1;
            
//            var newTweetText = !set.counter.TextStripped.has(tweet.TextStripped);

            if(repeatTextOK || newTweetText) { // Aggressive redundancy check
                
                // Count usual features
                this.feats.simple.forEach(function(feature) {
                    set.counter[feature].incr(tweet[feature]);
                });
                
                // Languages
                this.feats.lang.forEach(function(feature) {
                    set.counter[feature].incr(util.featureMatchName('Lang', tweet[feature].toLowerCase()));
                });
                
                // Get time features
                this.feats.time.forEach(function(feature) {
                    var time = tweet[feature];
                    time = util.formatDateToMinutes(util.date(time));
                    set.counter[feature].incr(time);
                });
                
                // Links
                this.feats.link.forEach(function(feature) {
                    var url = tweet[feature];
                    if(feature == 'ExpandedURL Domain') {
                        url = tweet['ExpandedURL'];
                        if(url) {
                            url = url.replace(
                                /.*:\/\/([^\/]*)(\/.*|$)/, '$1');
                        }
                    }
                    if(url) {
                        url = '<a href=' + url + ' target="_blank">' + url + '</a>';
                    }
                    set.counter[feature].incr(url);
                });
                
                // Quantities (no longer binned)
                this.feats.quantity.forEach(function(feature) {
                    set.counter[feature].incr(tweet[feature]);
                });
                
                // User Description Unigrams
                var desc = (tweet.UserDescription || '').toLowerCase();
                var desc_words = desc.split(/\W/).filter(function(word) { return word.length > 0; });
                if(desc_words.length == 0) {
                    desc_words = [tweet.UserDescription];
                }
                desc_words.forEach(function(word) {
                    set.counter['UserDescription Unigrams'].incr(word);
                });
                
                // Count Text features
                var text = tweet.TextStripped.toLowerCase();
                text = text.replace(/[^\w']+/g, ' ');
                text = text.replace(/(\w)' /g, '$1 ').replace(/ '(\w)/g, ' $1');
                var words = text.split(' ');
                var tweetgrams = [new Set(), new Set(), new Set(), new Set()];

                words.forEach(function(word, wi) {
                    if(word) {
                        var gram = word;
                        set.counter['TextUnigrams'].incr(gram);
                        if(!tweetgrams[0].has(gram)) {
                            tweetgrams[0].add(gram);
//                            ngrams.NGramHasCounter[0].incr(gram);
                        }
                        if(words[wi + 1]) {
                            gram += " " + words[wi + 1];
                            set.counter['TextBigrams'].incr(gram);
                            if(!tweetgrams[1].has(gram)) {
                                tweetgrams[1].add(gram);
//                                ngrams.NGramHasCounter[1].incr(gram);
                            }
                            if(words[wi + 2]) {
                                gram += " " + words[wi + 2];
                                set.counter['TextTrigrams'].incr(gram);
                                if(!tweetgrams[2].has(gram)) {
                                    tweetgrams[2].add(gram);
//                                    ngrams.NGramHasCounter[2].incr(gram);
                                }
                            }
                        }
                        for(var wj = wi + 1; wj < words.length; wj++) { 
                            gram = word + ' & ' + words[wj];
                            if(words[wj] < word)
                                gram = words[wj] + ' & ' + word;
                            // Add co-occurance
                            if(words[wj]) {
                                set.counter['TextCooccur'].incr(gram);
                                if(!tweetgrams[3].has(gram)) {
                                    tweetgrams[3].add(gram);
//                                    ngrams.CoOccurHasCounter.incr(gram);
                                }
                            }
                        }
                    }
                });
            } // New Tweet or New URL
        }
        
        triggers.emit('counters:show', setname);
    },
    showCounts: function(setname, comparesetname) { // TODO not sure if these parameters are even used
        // Get appropriate set names
        setname = 'event' + this.dataset.event.ID;
        if(this.dataset.subset) 
            setname = 'subset' + this.dataset.subset.ID;
        if(this.dataset.event2) 
            comparesetname = 'event' + this.dataset.event2.ID;
        if(this.dataset.subset2) 
            comparesetname = 'subset' + this.dataset.subset2.ID;
        
        // Get set and comparison set
        var set = this.data[setname];
        this.desc_a.selectAll('*').remove();
        this.desc_a.append('h3')
            .html('Set A: ' + set.label);
        this.desc_a.append('h4')
            .html(set.collection + ' ' + set.id);
        this.desc_a.append('p')
            .html('Tweets: ' + set.counted);
        
        this.desc_b.selectAll('*').remove();
        var cmp;
        if(comparesetname) {
            cmp = this.data[comparesetname];
            this.desc_b.append('h3')
                .html('Set B: ' + cmp.label);
            this.desc_b.append('h4')
                .html(cmp.collection + ' ' + cmp.id);
            this.desc_b.append('p')
                .html('Tweets: ' + cmp.counted);
        }
        
        // Get parameters
        var n = parseInt(this.ops['Display']['TopX'].get());
        var excludeStopwords = this.ops['Display']['Exclude Stopwords'].is('true');
        var count_quantity = this.ops['Display']['Count Quantity'].get();
        var cmp_quantity = this.ops['Display']['Cmp Quantity'].get();
        var order_by = this.ops['Display']['Order'].get();
        var order_sign = order_by == '-Ratio' || order_by == 'Token' ? -1 : 1;
        if(order_by == '-Ratio') order_by = 'Ratio';
        
        var table_divs = this.body.selectAll('div.feature-div')
            .data(this.feats.shown);
        
        // Make any missing tables
        var table_divs_new = table_divs.enter()
            .append('div')
            .attr('class', function(d) {
                return 'feature-div table-' + util.simplify(d);
            });
        table_divs_new.append('h4');
        table_divs_new.append('p');
        table_divs_new.append('table').append('thead');
        table_divs_new.select('table').append('tbody');
    
        // Add header
        table_divs.select('h4')
            .html(function(d) {
                return d.replace(/([a-z])([A-Z])/g, "$1 $2");
            });
        
        table_divs.select('p')
            .html(function(d) {
                return set.counter[d].tokens + ' tokens';
            });
        
        table_divs.select('table')
            .attr('class', function(d) { return 'table-' + util.simplify(d); });
        
        // Add statistics for quantitative features
        this.feats.quantity.forEach(function(feature) {
            var table = table_divs.select('.table-' + util.simplify(feature) + ' table')
                .classed('stats-table', true)
                .classed('token-freq-table', false);
            
            var stats = set.counter[feature].statistics();
            
            table.select('thead').selectAll('*').remove();
            
            var rows = table.select('tbody').selectAll('tr')
                .data(Object.keys(stats))
                .enter()
                .append('tr')
                .style('border-top', function(d) { 
                    return d == 'Mean' ? '3px solid' : 'none';
                });
            
            rows.append('th')
                .attr('class', 'stat-token')
                .html(function(d) { return d; });
            
            rows.append('td')
                .attr('class', 'stat-value')
                .html(function(d) {
                    var val = stats[d];
                    if(val == 0) return '0<span style="opacity: 0">.0</span>';
                    var formatted = util.formatThousands(val);
                    if(val % 1 > 0) {
                        formatted += (val % 1).toFixed(1).slice(1);
                    } else {
                        formatted += '<span style="opacity: 0">.0</span>';
                    }
    //                if(val % 1 > 0) val = val.toFixed(1);
                    return formatted; 
                })
        });
        
        // Add tables of counts
        this.feats.nominal.forEach(function(feature) {
            var table = table_divs.select('.table-' + util.simplify(feature) + ' table')
                .classed('stats-table', false)
                .classed('token-freq-table', true);
            
            // Add header if necessary
            var header = table.select('thead')
                .selectAll('tr')
                .data(function(d) { return [d]; })
                .enter()
                .append('tr');
            
            header.append('th')
                .attr('class', 'token')
                .html('Term');
            header.append('th')
                .attr('class', 'freq')
                .html('A');
            header.append('th')
                .attr('class', 'freq cell-cmp')
                .html('B');
            header.append('th')
                .attr('class', 'freq cell-cmp')
                .html('Cmp');

            var top_tokens;
            if(excludeStopwords && this.feats.hasStopwords.includes(feature)) {
                top_tokens = set.counter[feature].top_no_stopwords(n).map(function(d) { return d.key; });
            } else {
                top_tokens = set.counter[feature].top(n).map(function(d) { return d.key; });
            }
            if(cmp) {
                var cmp_tokens;
                if(excludeStopwords && this.feats.hasStopwords.includes(feature)) {
                    cmp_tokens = cmp.counter[feature].top_no_stopwords(n).map(function(d) { return d.key; });
                } else {
                    cmp_tokens = cmp.counter[feature].top(n).map(function(d) { return d.key; });
                }
                top_tokens = top_tokens.concat(cmp_tokens);
                top_tokens = util.lunique(top_tokens);
            }
            
            var entries = top_tokens.map(function(token) {
                var entry = {
                    Token: util.featureMatchName(feature, token),
                    Frequency: set.counter[feature].get(token)
                };
                entry['Percent']         = entry['Frequency'] / set.nTweets * 100;
                if(cmp) {
                    entry['Frequency B'] = cmp.counter[feature].get(token);
                    entry['Percent B']   = entry['Frequency B'] / cmp.nTweets * 100;
                    entry['Ratio']       = entry['Frequency'] / entry['Frequency B'];
                    entry['Log Ratio']   = Math.log(entry['Ratio']);
                }
                
                return entry;
            });
            
            // Sort Entries
            entries.sort(function(a, b) {
                if(a[order_by] < b[order_by]) return  1 * order_sign;
                if(a[order_by] > b[order_by]) return -1 * order_sign;
                if(a['Token']  < b['Token'] ) return  1 * order_sign;
                if(a['Token']  > b['Token'] ) return -1 * order_sign;
                return 0;
            });
            
            // Format Numbers
            entries.forEach(function(entry) {
                entry['Frequency'] = util.formatThousands(entry['Frequency']);
                entry['Percent']   = entry['Percent'].toFixed(1);
                if(cmp) {
                    entry['Frequency B'] = util.formatThousands(entry['Frequency B']);
                    entry['Percent B']   = entry['Percent B'].toFixed(1);
                    
                    var neg_ratio = entry['Ratio'] < 1;
                    if(entry['Ratio'] == Infinity) {
                        entry['Ratio'] = '&infin;' 
                        entry['Log Ratio'] = '&infin;' 
                    } else if(entry['Ratio'] == 0) {
                        entry['Log Ratio'] = '-&infin;' 
                    } else {
                        entry['Ratio'] = entry['Ratio'].toFixed(1);
                        entry['Log Ratio'] = entry['Log Ratio'].toFixed(1);
                    }
                    if(neg_ratio) {
                        entry['Ratio'] = '<span class="ratio-neg">' + entry['Ratio'] + '</span>';
                        entry['Log Ratio'] = '<span class="ratio-neg">' + entry['Log Ratio'] + '</span>';
                    }
                }
            });
            
            // Add rows
            var rows = table.selectAll('tbody')
                .selectAll('tr.token-freq-set');
            
            var rows_new = rows.data(entries)
                .enter()
                .append('tr')
                .attr('class', function(d, i) { return 'row' + i + ' token-freq-set'; });
//                .call(function(a, b) {
//                    console.log(this, a, b);
//                });

            rows_new.append('td')
                .attr('class', 'token');
            rows_new.append('td')
                .attr('class', 'freq freq-primary');
            rows_new.append('td')
                .attr('class', 'freq freq-secondary cell-cmp');
            rows_new.append('td')
                .attr('class', 'freq freq-cmp cell-cmp');
            
            // Propagate data
            rows.select('td.token');
            rows.select('td.freq-primary');
            rows.select('td.freq-secondary');
            rows.select('td.freq-cmp');            
        }, this);
        
        // Populate data
        table_divs.selectAll('tbody .token')
            .html(function(d) { 
                return d['Token'];
            });
        table_divs.selectAll('tbody .freq-primary')
            .html(function(d) { 
                if(count_quantity == 'freq')
                    return d['Frequency']; 
                return d['Percent']; 
            });
        
        if(cmp) {
            table_divs.selectAll('.cell-cmp')
                .classed('cell-hidden', false);
            
            table_divs.selectAll('tbody .freq-secondary')
                .html(function(d) { 
//                console.log(d);
                    if(count_quantity == 'freq')
                        return d['Frequency B']; 
                    return d['Percent B']; 
                });
            table_divs.selectAll('tbody .freq-cmp')
                .html(function(d) {
                    if(cmp_quantity == 'ratio')
                        return d['Ratio']; 
                    return d['Log Ratio'];
                });
        } else {
            table_divs.selectAll('.cell-cmp')
                .classed('cell-hidden', true);
        }
    }
};

function initialize() {
    FD = new FeatureDistribution();
    
    FD.init();
}
window.onload = initialize;