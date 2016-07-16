var sql = require('../');
var assert = require('assert');
var supp = require('../demo-support');
var config = require('./test-config');

var conn_str = config.conn_str;

suite('sproc', function () {
    var support = new supp.DemoSupport(sql, conn_str);
    var async = new support.Async();
    var theConnection;
    this.timeout(45000);

    function testBoilerPlate(proc_name, proc_sql, doneFunction) {

        var sequence = [

            function (async_done) {
                var dropQuery = "IF NOT EXISTS (SELECT *  FROM sys.objects WHERE type = 'P' AND name = '" + proc_name + "')";
                dropQuery += " EXEC ('create procedure " + proc_name + " as begin set nocount on; end')";
                theConnection.query(dropQuery, function (err) {
                    assert.ifError(err);
                    async_done();
                });
            },

            function (async_done) {
                theConnection.query(proc_sql,
                    function (e) {
                        assert.ifError(e, "Error creating proc");
                        async_done();
                    });
            }
        ];

        async.series(sequence,
            function () {
                doneFunction();
            });
    }

    setup(function (test_done) {
        sql.open(conn_str, function (err, new_conn) {
            assert.ifError(err);
            theConnection = new_conn;
            test_done();
        });
    });

    teardown(function (done) {
        theConnection.close(function (err) {
            assert.ifError(err);
            done();
        });
    });

    test('call proc that waits for delay of input param - wait 5, timeout 2 - should error', function (test_done) {

        var sp_name = "test_spwait_for";

        var def = "alter PROCEDURE <name>"+
            "(\n" +
            "@timeout datetime"+
            "\n)" +
            "AS\n" +
            "BEGIN\n" +
            "waitfor delay @timeout;"+
            "END\n";

        def = def.replace(/<name>/g, sp_name);

        testBoilerPlate(sp_name, def, go);

        function go() {
            var pm = theConnection.procedureMgr();
            pm.setTimeout(2);
            pm.callproc(sp_name, ['0:0:5'], function(err, results, output) {
                assert(err != null);
                assert(err.message.indexOf('Query timeout expired') > 0)
                test_done();
            });
        }
    });

    test('call proc that waits for delay of input param - wait 2, timeout 5 - should not error', function (test_done) {

        var sp_name = "test_spwait_for";

        var def = "alter PROCEDURE <name>"+
            "(\n" +
            "@timeout datetime"+
            "\n)" +
            "AS\n" +
            "BEGIN\n" +
            "waitfor delay @timeout;"+
            "END\n";

        def = def.replace(/<name>/g, sp_name);

        testBoilerPlate(sp_name, def, go);

        function go() {
            var pm = theConnection.procedureMgr();
            pm.setTimeout(5);
            pm.callproc(sp_name, ['0:0:2'], function(err, results, output) {
                assert.ifError(err);
                test_done();
            });
        }
    });

    test('call proc that returns length of input string and decribes itself in results', function (test_done) {

        var sp_name = "test_sp";

        var def = "alter PROCEDURE <name> @param VARCHAR(50) \n"
            + " AS \n"
            + " BEGIN \n"
            + "     SELECT name, type, type_desc  FROM sys.objects WHERE type = 'P' AND name = '<name>'"
            + "     RETURN LEN(@param); \n"
            + " END \n";

        def = def.replace(/<name>/g, sp_name);

        testBoilerPlate(sp_name, def, go);

        function go() {
            var pm = theConnection.procedureMgr();
            pm.callproc(sp_name, ["US of A!"], function(err, results, output) {
                var expected = [8];
                assert.deepEqual(output, expected, "results didn't match");
                expected = [
                    {
                        name: sp_name,
                        type: 'P ',
                        type_desc: 'SQL_STORED_PROCEDURE'
                    }];
                assert.deepEqual(results, expected, "results didn't match");
                test_done();
            });
        }
    });

    test('call proc that returns length of input string', function (test_done) {

        var sp_name = "test_sp";

        var def = "alter PROCEDURE <name> @param VARCHAR(50) \n"
            + " AS \n"
            + " BEGIN \n"
            + "     RETURN LEN(@param); \n"
            + " END \n";

        def = def.replace(/<name>/g, sp_name);

        testBoilerPlate(sp_name, def, go);

        function go() {
            var pm = theConnection.procedureMgr();
            pm.callproc(sp_name, ["US of A!"], function(err, results, output) {
                var expected = [8];
                assert.deepEqual(output, expected, "results didn't match");
                test_done();
            });
        }
    });

    test('call proc that has 2 output string params + return code', function (test_done) {

        var sp_name = "test_sp_get_str_str";

        var def = "alter PROCEDURE <name>"+
            "(\n" +
            "@id INT,\n" +
            "@name varchar(20) OUTPUT,\n" +
            "@company varchar(20) OUTPUT\n" +
            "\n)" +
            "AS\n" +
            "BEGIN\n" +
            "   SET @name = 'name'\n"+
            "   SET @company = 'company'\n"+
            "   RETURN 99;\n"+
            "END\n";

        def = def.replace(/<name>/g, sp_name);

        testBoilerPlate(sp_name, def, go);

        function go() {
            var pm = theConnection.procedureMgr();
            pm.callproc(sp_name, [1], function(err, results, output) {
                var expected = [99, 'name', 'company'];
                assert.deepEqual(output, expected, "results didn't match");
                test_done();
            });
        }
    });

    test('call proc that has 2 input params + 1 output', function (test_done) {

        var sp_name = "test_sp_get_int_int";

        var def = "alter PROCEDURE <name>"+
            "(\n" +
            "@num1 INT,\n" +
            "@num2 INT,\n" +
            "@num3 INT OUTPUT\n" +
            "\n)" +
            "AS\n" +
            "BEGIN\n" +
            "   SET @num3 = @num1 + @num2\n"+
            "   RETURN 99;\n"+
            "END\n";

        def = def.replace(/<name>/g, sp_name);

        testBoilerPlate(sp_name, def, go);

        function go() {
            var pm = theConnection.procedureMgr();
            pm.callproc(sp_name, [10, 5], function(err, results, output) {
                var expected = [99, 15];
                assert.deepEqual(output, expected, "results didn't match");
                test_done();
            });
        }
    });
});



