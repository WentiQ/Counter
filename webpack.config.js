const path = require('path');

module.exports = {
    mode: 'development',
    entry: {
        main: './public/script.js',
        calendar: './public/calendar.js'
    },
    output: {
        path: path.resolve(__dirname, 'public/dist'),
        filename: '[name].bundle.js'
    },
    devServer: {
        static: {
            directory: path.join(__dirname, 'public'),
        },
        compress: true,
        port: 9000,
    }
};
