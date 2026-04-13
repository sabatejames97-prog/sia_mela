import type { Schema, Struct } from '@strapi/strapi';

export interface BatchBatch extends Struct.ComponentSchema {
  collectionName: 'components_batch_batches';
  info: {
    displayName: 'batch';
  };
  attributes: {
    batch_note: Schema.Attribute.String;
    expiration_date: Schema.Attribute.Date;
    is_expired: Schema.Attribute.Boolean;
    sellingPrice: Schema.Attribute.Decimal & Schema.Attribute.Required;
    stock: Schema.Attribute.Integer;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'batch.batch': BatchBatch;
    }
  }
}
