'use strict';

const stringify = require('json-stringify-deterministic');
const sortKeysRecursive = require('sort-keys-recursive');
const { Contract } = require('fabric-contract-api');

class ArtifactTransfer extends Contract {

    async InitLedger(ctx) {
        // Initialize ledger with sample data
    }

    async CreateArtifact(ctx, id, issuer, createdDate, expiryDate, checksum) {
        const exists = await this.ArtifactExists(ctx, id);
        if (exists) {
            throw new Error(`The artifact ${id} already exists`);
        }

        // Create whole artifact
        const wholeArtifact = {
            ID: id,
            Issuer: issuer,
            CreatedDate: createdDate,
            ExpiryDate: expiryDate,
            Checksum: checksum,
            Label: 'whole',
        };
        await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(wholeArtifact))));

        // Create segment artifacts
        const segmentArtifacts = [];
        const data = JSON.stringify(wholeArtifact);
        const segmentSize = Math.ceil(data.length / 3);
        for (let i = 0; i < 3; i++) {
            const segmentData = data.substring(i * segmentSize, (i + 1) * segmentSize);
            const segmentArtifact = {
                ID: `${id}_segment${i}`,
                DataSegment: segmentData,
                Label: 'segment',
            };
            await ctx.stub.putState(`${id}_segment${i}`, Buffer.from(stringify(sortKeysRecursive(segmentArtifact))));
            segmentArtifacts.push(segmentArtifact);
        }

        // Create checksum artifact
        const checksumArtifact = {
            ID: `${id}_checksum`,
            Checksum: checksum,
            Label: 'checksum',
        };
        await ctx.stub.putState(`${id}_checksum`, Buffer.from(stringify(sortKeysRecursive(checksumArtifact))));

        return {
            wholeArtifact,
            segmentArtifacts,
            checksumArtifact
        };
    }

    async ReadArtifact(ctx, id) {
        const artifactJSON = await ctx.stub.getState(id);
        if (!artifactJSON || artifactJSON.length === 0) {
            throw new Error(`The artifact ${id} does not exist`);
        }
        return artifactJSON.toString();
    }

    async UpdateArtifact(ctx, id, issuer, createdDate, expiryDate, checksum) {
        const exists = await this.ArtifactExists(ctx, id);
        if (!exists) {
            throw new Error(`The artifact ${id} does not exist`);
        }

        const updatedArtifact = {
            ID: id,
            Issuer: issuer,
            CreatedDate: createdDate,
            ExpiryDate: expiryDate,
            Checksum: checksum,
            Label: 'whole',
        };
        await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(updatedArtifact))));

        // Update segment artifacts
        const data = JSON.stringify(updatedArtifact);
        const segmentSize = Math.ceil(data.length / 3);
        for (let i = 0; i < 3; i++) {
            const segmentData = data.substring(i * segmentSize, (i + 1) * segmentSize);
            const segmentArtifact = {
                ID: `${id}_segment${i}`,
                DataSegment: segmentData,
                Label: 'segment',
            };
            await ctx.stub.putState(`${id}_segment${i}`, Buffer.from(stringify(sortKeysRecursive(segmentArtifact))));
        }

        // Update checksum artifact
        const checksumArtifact = {
            ID: `${id}_checksum`,
            Checksum: checksum,
            Label: 'checksum',
        };
        await ctx.stub.putState(`${id}_checksum`, Buffer.from(stringify(sortKeysRecursive(checksumArtifact))));

        return {
            wholeArtifact: updatedArtifact,
            segmentArtifacts: [],
            checksumArtifact
        };
    }

    async DeleteArtifact(ctx, id) {
        const exists = await this.ArtifactExists(ctx, id);
        if (!exists) {
            throw new Error(`The artifact ${id} does not exist`);
        }

        // Delete whole artifact
        await ctx.stub.deleteState(id);

        // Delete segment artifacts
        for (let i = 0; i < 3; i++) {
            await ctx.stub.deleteState(`${id}_segment${i}`);
        }

        // Delete checksum artifact
        await ctx.stub.deleteState(`${id}_checksum`);

        return `Artifact ${id} has been deleted successfully`;
    }

    async ArtifactExists(ctx, id) {
        const artifactJSON = await ctx.stub.getState(id);
        return artifactJSON && artifactJSON.length > 0;
    }

    async TransferArtifact(ctx, id, newOwner) {
        const artifactString = await this.ReadArtifact(ctx, id);
        const artifact = JSON.parse(artifactString);
        const oldIssuer = artifact.Issuer;
        artifact.Issuer = newOwner;
        await ctx.stub.putState(id, Buffer.from(stringify(sortKeysRecursive(artifact))));
        return oldIssuer;
    }

    async GetAllArtifacts(ctx) {
        const allResults = [];
        const iterator = await ctx.stub.getStateByRange('', '');
        let result = await iterator.next();
        while (!result.done) {
            const strValue = Buffer.from(result.value.value.toString()).toString('utf8');
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            allResults.push(record);
            result = await iterator.next();
        }
        return JSON.stringify(allResults);
    }
}

module.exports = ArtifactTransfer;

