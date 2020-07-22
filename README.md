# quervana
## A SQL Server ORM and Query Loader for GraphQL

Quervana is a super simple, easy-to-setup library tailored for GraphQL APIs whose main purpose is to access data from a SQL Server database ***efficiently***.

## quervana key features:
1. Automatic model generation from your database, meaning no need to define your model in code or pass parameter types to basic operations
2. Automatic operation batching, making it perfect for GraphQL; no more clunky loader patterns
3. Automatic object-relational mapping that you can override to match your existing sql and javascript conventions, so you can get convenient object-relational mapping for any MSSQL database
4. Batch any arbitrary SQL
5. More convenience than other libraries

## Why would I use this?
If you're building a GraphQL API that interacts with a SQL Server database, you should strongly consider this library. If you are generally just making a Node application that interacts with a SQL Server database, this library may be for you if you find that other ORMs like Sequelize are too high of a commitment or you're planning on doing more custom SQL than query building. If you potentially could switch away from SQL Server, do NOT use this library: other ORMs that support multiple database technologies will make that transition more seamless.


## Setting up
First, let's import the core components of the library.
```const { initQuervana, createPool, generateModel } = require('quervana');```

`initQuervana(pool, schemaName, model, translator)` takes 4 arguments: a pool, a schema name, a model, and a translator object.

The pool can be created using createPool like this:
`const pool = await createPool(config)`
where the config looks like this:
```
{
    server: 'mydatabase.database.windows.net',
    database: 'mydb',
    user: 'user',
    password: 'greatpassword',
    options: {
      ...{ optional parameters per mssql docs }
}
```
Your model can be generated directly from your database by calling generateModel:
`const model = await generateModel(pool, schemaName)`

The `schemaName` is the name of the schema that your entities (table names) belong too. If you need to switch schemas, you will need to call `initQuervana` again with your pool and model but a new schema name.

The translator object is an object with two functions: `objToRel` and `relToObj`. These functions take care of the mapping between your database names and your code names, making it possible for you to integrate with existing databases without enforcing any particular naming convenctions. For example, the default translator assumes the names in your database are snake case, like `my_snake_case_table`, whereas the code is camel, so we want it to look like `mySnakeCaseTable`. Our translator will look like
this:
```
{
    objToRel: (str) => str.split(/(?=[A-Z])/).join('_').toLowerCase(),
    relToObj: (str) => str.replace(/_([a-z])/g, g => g[1].toUpperCase())
}
```
You can use these functions to handle exceptions-to-the-rules as well. 

## Batching
This uses Facebook’s `dataloader` under the hood, so if you are familiar with it, you can think of quervana as a dynamic one-size-fits-all loader.

## Using the library

Let's attach a quervana instance to our context object. Note that we'll want to create a new instance for each request, as this instantiates a new loader instance as well.

```
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async () => ({ quervana: initQuervana(pool, schemaName, model, translator ) }),
});
```

We can now really easily query entities!

## Basic Operations

Quervana supports `get`, `getAll`, `insert`, `insertMany`, `update`, and `delete` at this time. These are useful short-hands, as they create parameterized queries but do not need parameter types passed to them. Each operation return a Promise of the affected rows.

### Getting

**A simple get:**

All calls to `quervana.get` in a single tick of the event loop will be batched into atomic gets by entity and key.

```
const Query = {
  zooKeeper: async (obj, { id }, { quervana }) => quervana.get({ entity: 'zooKeeper', where: 'id', is: id }),
};
```
If you're expecting an array of entities back, add `multiple = true` to your query. Otherwise, we return the first instance:
```
const Habitat = {
  animals: async ({ id }, args, { quervana }) => quervana.get({ entity: 'animal', where: 'habitatId', is: id, multiple = true }),
};
```

**Get all of an entity:**
```
const Query = {
  animals: async (obj, { id }, { quervana }) => quervana.getAll({ entity: 'animal' }),
};
```

Calls to 'getAll' are not batched.

### Inserting

A **single insertion** looks like this. The keys of the `input` should directly map to fields on your entity table per the specs of your translator:

```
const Mutation = {
  createAnimal: async (obj, { input }, { quervana }) => quervana.insert({ entity: 'animal', input }),
};
```

We can **insertMany** like this, where `inputArray` is an array of inputs:

```
const Mutation = {
  createAnimals: async (obj, { input }, { quervana }) => quervana.insertMany({ entity: 'animal', inputArray }),
};
```

### Deleting

To **hard-delete**, use the following:

```
const Mutation = {
  deleteAnimal: async (obj, { id }, { quervana }) => quervana.remove({ entity: 'animal', where: 'id', is: id }),
};
```

### Updating

```
const Mutation = {
  updateAnimal: async (obj, { input: { payload, id } }, { quervana }) => quervana.update({
    entity: 'animal', input: payload, where: 'id', is: id,
  }),
};
```

## Custom sql execution

We can use `quervana.executeSql` to run custom sql WITHOUT batching. It takes an object with 3 fields:

`quervana.executeSql({ queryString, params, paramTypes });`

The query string is our custom query. Parameterization is done via the @ symbol:
`SELECT * from person WHERE name = @name;`

`params` will be our input, like `{ name: 'George' }`, matching the @param in your query.

`paramTypes` describes the types of the input fields, like `{ name: sqlTypes.varChar(50) }`. These should come from our model that we generated. You could access the model directly like `quervana.model.person.name.type`, or we can use a handy method on the quervana object called `getParamTypes` which will return the types:

`const types = quervana.getParamTypes({ entity: 'person', params: ['name']})`

## batchSql

This is one of the most powerful features of quervana. You can use it to batch any arbitrary sql.

Using the [BATCH] symbol, we can add to our batch, and quervana will automatically map results back to whatever call added that particular value. This looks like:
```
const queryString = '
  SELECT
  test.animal.id,
  test.animal.name,
  test.zoo.id AS zoo_id,
  test.zoo.city
  FROM test.animal JOIN test.zoo ON test.animal.zoo_id = test.zoo.id
  WHERE test.zoo.id IN [BATCH]';

  const results = await Promise.all([
    quervana.batchSql({
      queryString,
      addToBatch: 0,
      batchEntity: 'zoo',
      batchParam: 'id',
      multiple: true,
    }),
    quervana.batchSql({
      queryString,
      addToBatch: 1,
      batchEntity: 'zoo',
      batchParam: 'id',
      multiple: true,
    }),
    quervana.batchSql({
      queryString,
      addToBatch: 2,
      batchEntity: 'zoo',
      batchParam: 'id',
      multiple: true,
    })]);
```

These calls to `batchSql` will be merged together. The result to each will be determined by the `addToBatch`, `batchEntity`, and `batchParam` parameters; the row where these all match the original call will be returned. You can even rename your parameter as demonstrated here: `test.zoo.id AS zoo_id`, and the results will still be properly mapped back.

You can also use `params` and `paramTypes` as described above in `executeSql`; `batchSql` will separate batched queries based on these additional parameters.

## Optional Parameters

**transform, transformMultiple**

`get` and `batchSql` both have access to these optional parameters.
Use these parameters to transform a result or the result set before returning it. Though async/await will give you the same load benefits (provided they happen in the same event loop tick, so careful when doing async/await sequentially), part of the quervana philosophy is that every GraphQL resolver returns a quervana promise. `transform` and `transformMultiple` helps make that possible by adding additional business logic to your data.

```quervana.batchSql({
      queryString: 'SELECT
                    test.animal.id,
                    test.animal.name,
                    test.zoo.id AS zoo_id,
                    test.zoo.city
                    FROM test.animal JOIN test.zoo ON test.animal.zoo_id = test.zoo.id
                    WHERE test.zoo.id IN [BATCH]',
      addToBatch: 'Boston',
      batchEntity: 'zoo',
      batchParam: 'city',
      multiple: true,
      transformMultiple: results => results.map(result => result.name).join(', ),
    })
  ```

This will return a comma separated string of all the animal names that live in the Boston zoo. 

If you have `multiple = false` as is default, then use the `transform` parameter instead to transform that single result.

**returnField**

`returnField` is an optional parameter for `get` which returns only a single field from the result. It is essentially short-hand for the `transform` function: `result => result[returnField]`

**parameterize**

You can set `parameterize = false` for `batchSql` if for some reason the 2100 parameter limit is too low for your query, or for performance reasons. Note that this is rarely a good idea: consider paginating your query if you are having these issues, or if you do decide to turn parameterization off, make super sure that your validation doesn't allow for any SQL injection funny business.

## Examples

See the `test.js` file to see some basic usage.

## Testing & Contributing

To run tests, use the command `npm test`. Note you will need Docker and docker-compose to run these. You will need to create an `.env` file with the `env.example` parameters in the top of the package. Feel free to make changes and let me know if you have feedback, code contributions, or found any bugs!

Anyway that's about it! Let me know if you found this useful or not.
