import { Component, OnInit } from '@angular/core';

import {
  KeyHelper,
  SignedPublicPreKeyType,
  SignalProtocolAddress,
  SessionBuilder,
  PreKeyType,
  SessionCipher,
  MessageType
}
  from '@privacyresearch/libsignal-protocol-typescript'
import { SignalDirectory } from './signal-directory';
import { SignalProtocolStore } from './storage-type';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  //Alice
  aliceAddress: SignalProtocolAddress;
  aliceStore = new SignalProtocolStore();
  alicePhoneNumber = "8801620588065";
  aliceHasIdentity = false;
  sessionStarted = false;
  aliceInbox = [];

  createAliceIdentity = async () => {
    await this.createID(this.alicePhoneNumber, this.aliceStore);
    this.aliceHasIdentity = true;
    console.log("aliceHasIdentity", this.aliceHasIdentity);
  };

  startSessionWithBob = async () => {
    const bobBundle = this.directory.getPreKeyBundle(this.bobPhoneNumber);
    console.log("bobBundle", bobBundle);
    const recipientAddress = this.bobAddress;
    const sessionBuilder = new SessionBuilder(this.aliceStore, recipientAddress);
    console.log("alice processing prekey");
    await sessionBuilder.processPreKey(bobBundle!);
    this.sessionStarted = true;
  };

  encryptAndSendMessageToBob = async (message: string) => {
    console.log("Alice Text to Bob", message);
    const cipher = new SessionCipher(this.aliceStore, this.bobAddress);
    const ciphertext = await cipher.encrypt(
      new TextEncoder().encode(message).buffer
    );
    console.log("ciphertext to bob", ciphertext);
    this.aliceInbox.push(message);
    this.receiveCipherTextFromAliceAndDecrypt(ciphertext).then(plainText => {
      this.bobInbox.push(plainText);
    })
    console.log(this.bobInbox)
  };

  receiveCipherTextFromBobAndDecrypt = async (message: MessageType) => {
    const cipher = new SessionCipher(this.aliceStore, this.bobAddress);
    let plaintext: ArrayBuffer = new Uint8Array().buffer;
    if (message.type === 3) plaintext = await cipher.decryptPreKeyWhisperMessage(message.body!, "binary");
    else if (message.type === 1) plaintext = await cipher.decryptWhisperMessage(message.body!, "binary");
    const plainText = new TextDecoder().decode(new Uint8Array(plaintext));
    console.log("Decrypted text from bob to alice", plainText);
    return plainText;
  };




  //Bob
  bobAddress: SignalProtocolAddress;
  bobStore = new SignalProtocolStore();
  bobPhoneNumber = "8801731749956";
  bobHasIdentity = false;
  bobInbox = [];

  createBobIdentity = async () => {
    await this.createID(this.bobPhoneNumber, this.bobStore);
    this.bobHasIdentity = true;
    console.log("bobHasIdentity", this.bobHasIdentity);
  };

  startSessionWithAlice = async () => {
    const aliceBundle = this.directory.getPreKeyBundle(this.alicePhoneNumber);
    console.log("bobBundle", aliceBundle);
    const recipientAddress = this.aliceAddress;
    const sessionBuilder = new SessionBuilder(this.bobStore, recipientAddress);
    console.log("alice processing prekey");
    await sessionBuilder.processPreKey(aliceBundle!);
    this.sessionStarted = true;
  };

  encryptAndSendMessageToAlice = async (message: string) => {
    console.log("Bob Text to Alice", message);
    const cipher = new SessionCipher(this.bobStore, this.aliceAddress);
    const ciphertext = await cipher.encrypt(
      new TextEncoder().encode(message).buffer
    );
    console.log("ciphertext to alice", ciphertext);
    this.bobInbox.push(message);
    this.receiveCipherTextFromBobAndDecrypt(ciphertext).then(plainText => {
      this.aliceInbox.push(plainText);
    })
  };

  receiveCipherTextFromAliceAndDecrypt = async (message: MessageType) => {
    const cipher = new SessionCipher(this.bobStore, this.aliceAddress);
    let plaintext: ArrayBuffer = new Uint8Array().buffer;
    if (message.type === 3) plaintext = await cipher.decryptPreKeyWhisperMessage(message.body!, "binary");
    else if (message.type === 1) plaintext = await cipher.decryptWhisperMessage(message.body!, "binary");
    const plainText = new TextDecoder().decode(new Uint8Array(plaintext));
    console.log("Decrypted text from alice to bob", plainText);
    return plainText;
  };



  //common
  directory = new SignalDirectory();
  creaTeSignalProtocolAddress(phoneNumber, deviceId) {
    return new SignalProtocolAddress(phoneNumber, deviceId);
  }

  storeSafe = (store: SignalProtocolStore) => (
    key: string,
    value: any
  ) => {
    store.put(key, value);
  };

  async createID(phoneNumber: string, store: SignalProtocolStore) {
    const registrationId = KeyHelper.generateRegistrationId();
    // Store registrationId somewhere durable and safe... Or do this.
    this.storeSafe(store)(`registrationID`, registrationId);

    const identityKeyPair = await KeyHelper.generateIdentityKeyPair();
    // Store identityKeyPair somewhere durable and safe... Or do this.
    this.storeSafe(store)("identityKey", identityKeyPair);

    const baseKeyId = Math.floor(10000 * Math.random());
    const preKey = await KeyHelper.generatePreKey(baseKeyId);
    store.storePreKey(`${baseKeyId}`, preKey.keyPair);

    const signedPreKeyId = Math.floor(10000 * Math.random());
    const signedPreKey = await KeyHelper.generateSignedPreKey(
      identityKeyPair,
      signedPreKeyId
    );
    store.storeSignedPreKey(signedPreKeyId, signedPreKey.keyPair);
    const publicSignedPreKey: SignedPublicPreKeyType = {
      keyId: signedPreKeyId,
      publicKey: signedPreKey.keyPair.pubKey,
      signature: signedPreKey.signature,
    };

    // Now we register this with the server so all users can see them
    const publicPreKey: PreKeyType = {
      keyId: preKey.keyId,
      publicKey: preKey.keyPair.pubKey,
    };
    this.directory.storeKeyBundle(phoneNumber, {
      registrationId,
      identityPubKey: identityKeyPair.pubKey,
      signedPreKey: publicSignedPreKey,
      oneTimePreKeys: [publicPreKey],
    });
    console.log("Identity generated");
  };

  ngOnInit(): void {
    this.aliceAddress = this.creaTeSignalProtocolAddress(this.alicePhoneNumber, 1);
    console.log("alice address", this.aliceAddress);
    this.bobAddress = this.creaTeSignalProtocolAddress(this.bobPhoneNumber, 2);
    console.log("bob address", this.bobAddress);

  }


}
