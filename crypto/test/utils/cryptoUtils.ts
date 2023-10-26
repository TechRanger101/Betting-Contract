/*
  This gist's core function is verifyJwt, whose purpose is to verify JWT's signed
    using RS256
  The public key needs to be provided as n (modulus) and e (exponent).
  JWT algorithm RS256 in fact means RSASSA-PKCS1-v1_5 using SHA-256:
    https://tools.ietf.org/html/rfc7518#section-3.1
  The specification of RSASSA-PKCS1-v1_5 specifies the steps to verify signatures:
    https://tools.ietf.org/html/rfc8017#section-8.2.2  
  The implementation here follows that specification to the letter: variable names are
    chosen to match 1:1 with the spec.
*/
import { createHash } from 'crypto'

export function verifyJwt(
  jwt: string,
  publicKey: PublicKey,
  options: { audience: string; issuer: string }
) {
  /*
    Verify the JWT. If valid, the payload is returned. In not valid, an error is thrown
  */

  // Decompose JWT
  const [headerB64, payloadB64, signatureB64] = jwt.split('.')

  // Check JWT signature algorithm
  const header = JSON.parse(Buffer.from(headerB64, 'base64').toString('utf8')) as JwtHeader
  if (header.alg !== 'RS256') {
    throw new Error(`Wrong JWT alg claim: ${header.alg}, expected: "RS256"`)
  }

  // Verify the JWT signature
  const M = Buffer.from(`${headerB64}.${payloadB64}`)
  const S = Buffer.from(signatureB64, 'base64')
  rsassaPkcs1V1_5Verify(publicKey, M, S)

  // Check JWT payload contents
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8')) as JwtPayload

  // Check audience claim
  if (payload.aud !== options.audience) {
    throw new Error(`Wrong JWT aud claim: "${payload.aud}", expected: "${options.audience}"`)
  }

  // Check issuer claim
  if (payload.iss !== options.issuer) {
    throw new Error(`Wrong JWT iss claim: "${payload.iss}", expected: "${options.issuer}"`)
  }

  return payload
}

function rsassaPkcs1V1_5Verify(publicKey: PublicKey, M: Buffer, S: Buffer) {
  /*
  RSASSA-PKCS1-V1_5-VERIFY ((n, e), M, S)
  Input:
      (n, e)  signer's RSA public key
      M       message whose signature is to be verified, an octet string
      S       signature to be verified, an octet string of length k,
              where k is the length in octets of the RSA modulus n
  Steps:
      1.  Length checking: If the length of the signature S is not k
          octets, output "invalid signature" and stop.
  */
  const k = publicKey.n.length
  if (S.length !== k) {
    throw new Error('invalid signature')
  }

  /*
      2.  RSA verification: calculate EM (encoded message)
  */
  const EM = rsaVerification(S, publicKey, k)

  /*
      3.  EMSA-PKCS1-v1_5 encoding: determine EM' (second encoded message)
  */
  const EMaccent = emsaPkcs1V1_5Encode(M, k)

  /*
      4.  Compare the encoded message EM and the second encoded message
          EM'.  If they are the same, output "valid signature";
          otherwise, output "invalid signature".
  */
  if (!EM.equals(EMaccent)) {
    throw new Error('invalid signature')
  }
}

function emsaPkcs1V1_5Encode(M: Buffer, emLen: number) {
  /*
    Input:
      M         message to be encoded
      emLen     intended length in octets of the encoded message, at
                least tLen + 11, where tLen is the octet length of the
                Distinguished Encoding Rules (DER) encoding T of
                a certain value computed during the encoding operation
    Output:
      EM        encoded message, an octet string of length emLen
  */

  /*
  1. Apply the hash function to the message M to produce a hash value H:
          H = Hash(M).
  */
  const H = createHash('sha256').update(M).digest()

  /*
  2. Encode the algorithm ID for the hash function and the hash value
      into an ASN.1 value of type DigestInfo (see Appendix A.2.4) with
      the Distinguished Encoding Rules (DER), where the type DigestInfo
      has the syntax
      DigestInfo ::= SEQUENCE {
          digestAlgorithm AlgorithmIdentifier,
          digest OCTET STRING
      }
      The first field identifies the hash function and the second
      contains the hash value.  Let T be the DER encoding of the
      DigestInfo value (see the notes below) and let tLen be the length
      in octets of T.
      Notes:
      1.  For the nine hash functions mentioned in Appendix B.1, the DER
          encoding T of the DigestInfo value is equal to the following:
          ...
          SHA-256: (0x)30 31 30 0d 06 09 60 86 48 01 65 03 04 02 01 05 00
                        04 20 || H.
          ...
  */
  const T = Buffer.concat([
    Buffer.from([
      0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01,
      0x05, 0x00, 0x04, 0x20,
    ]),
    H,
  ])
  const tLen = T.length

  /*
      3.  If emLen < tLen + 11, output "intended encoded message length
          too short" and stop.
  */
  if (emLen < tLen + 11) {
    throw new Error('intended encoded message length too short')
  }

  /*
      4.  Generate an octet string PS consisting of emLen - tLen - 3
          octets with hexadecimal value 0xff.  The length of PS will be
          at least 8 octets.
  */
  const PS = Buffer.alloc(emLen - tLen - 3, Buffer.from('ff', 'hex'))

  /*
      5.  Concatenate PS, the DER encoding T, and other padding to form
          the encoded message EM as
              EM = 0x00 || 0x01 || PS || 0x00 || T.
  */
  const EM = Buffer.concat([
    Buffer.from('00', 'hex'),
    Buffer.from('01', 'hex'),
    PS,
    Buffer.from('00', 'hex'),
    T,
  ])

  return EM
}

function rsaVerification(S: Buffer, publicKey: PublicKey, k: number) {
  /*
    a.  Convert the signature S to an integer signature
        representative s (see Section 4.2):
          s = OS2IP (S).
  */
  const s = os2ip(S)

  /*
    b.  Apply the RSAVP1 verification primitive (Section 5.2.2) to
        the RSA public key (n, e) and the signature representative
        s to produce an integer message representative m:
          m = RSAVP1 ((n, e), s).
        If RSAVP1 outputs "signature representative out of range",
        output "invalid signature" and stop.
  */
  const m = rsavp1(publicKey, s)

  /*
    c.  Convert the message representative m to an encoded message
        EM of length k octets (see Section 4.1):
          EM = I2OSP (m, k).
  */
  const EM = i2osp(m, k)

  return EM
}
export function i2osp(x: bigint, xLen: number) {
  /*
  I2OSP converts a nonnegative integer to an octet string of a
  specified length.
  Input:
      x        nonnegative integer to be converted
      xLen     intended length of the resulting octet string
  Output:
      X        corresponding octet string of length xLen
  Steps:
      1.  If x >= 256^xLen, output "integer too large" and stop.
  */
  if (x >= BigInt(256) ** BigInt(xLen)) {
    throw new Error('integer too large')
  }

  /*
      2.  Write the integer x in its unique xLen-digit representation in
          base 256:
            x = x_(xLen-1) 256^(xLen-1) + x_(xLen-2) 256^(xLen-2) + ...
            + x_1 256 + x_0,
          where 0 <= x_i < 256 (note that one or more leading digits
          will be zero if x is less than 256^(xLen-1)).
  */
  const octets = Buffer.alloc(xLen)
  octets.forEach((_, index) => {
    octets[index] = Number(x % BigInt(256))
    x /= BigInt(256)
  })

  /*
      3.  Let the octet X_i have the integer value x_(xLen-i) for 1 <= i
          <= xLen.  Output the octet string
            X = X_1 X_2 ... X_xLen.
  */
  return octets.reverse()
}

export function os2ip(X: Buffer) {
  /*
    OS2IP converts an octet string to a nonnegative integer.
    Input:  X octet string to be converted
    Output:  x corresponding nonnegative integer
    Steps:
      1.  Let X_1 X_2 ... X_xLen be the octets of X from first to last,
          and let x_(xLen-i) be the integer value of the octet X_i for 1
          <= i <= xLen.
      2.  Let x = x_(xLen-1) 256^(xLen-1) + x_(xLen-2) 256^(xLen-2) +
          ...  + x_1 256 + x_0.
      3.  Output x.
  */

  const x = Buffer.from(X)
    .reverse()
    .reduce(
      (total, value, index) => (total += BigInt(value) * BigInt(256) ** BigInt(index)),
      BigInt(0)
    )
  return x
}

function rsavp1(publicKey: PublicKey, s: bigint) {
  /*
    Input:
        (n, e) RSA public key
        s signature representative, an integer between 0 and n - 1
    Output:
        m message representative, an integer between 0 and n - 1
    Steps:
      1.  If the signature representative s is not between 0 and n - 1,
          output "signature representative out of range" and stop.
      2.  Let m = s^e mod n.
          (Note: here implemented conform Right-to-left binary method:
            https://en.wikipedia.org/wiki/Modular_exponentiation#Right-to-left_binary_method)
      3.  Output m.
  */
  const n_as_int = os2ip(publicKey.n)
  let e_as_int = os2ip(publicKey.e)
  if (BigInt(0) > s || s >= n_as_int - BigInt(1)) {
    throw new Error('signature representative out of range')
  }
  if (n_as_int === BigInt(1)) {
    return BigInt(0)
  }
  let result = BigInt(1)
  s %= n_as_int
  let c = 0
  while (e_as_int > 0) {
    c++
    if (e_as_int % BigInt(2) === BigInt(1)) {
      result = (result * s) % n_as_int
    }
    e_as_int >>= BigInt(1)
    s = (s * s) % n_as_int
  }
  return result
}

export interface JwtHeader {
  alg: 'RS256' | string
  kid: string
}

export interface JwtPayload {
  exp: number // expires
  aud: string // audience
  iss: string // issuer
  [key: string]: any
}

export type JwtSignature = Buffer

export interface PublicKey {
  n: Buffer // modulus
  e: Buffer // exponent
}
